import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  type AuthTokens,
  type LoginRequest,
  REFRESH_TOKEN_TTL_SECONDS,
  type RegisterRequest,
  type User,
} from '@rulet/shared';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasher } from './password-hasher.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';
import { type NewSession, SessionsRepository } from './sessions.repository.js';

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

// Mensajes deliberadamente genéricos: no revelan si un email existe ni por qué falló una sesión.
const INVALID_CREDENTIALS = 'Credenciales inválidas';
const INVALID_SESSION = 'Sesión no válida o caducada';
const REGISTRATION_FAILED = 'No se ha podido completar el registro';

/**
 * Duración máxima de una familia de sesiones desde el login, por mucho que se refresque: pasado este
 * límite hay que volver a autenticarse (un refresh token robado no da acceso indefinido).
 */
export const MAX_SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

/**
 * Lógica de autenticación, independiente del transporte (cookies o cuerpo lo decide el controller).
 * Refresh tokens con rotación y detección de reutilización: cada uso revoca el token y emite otro de
 * la misma familia; si llega un token ya revocado, alguien lo ha copiado y se revoca toda la familia.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsRepository,
    private readonly passwords: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.create({ email: input.email, passwordHash, name: input.name });
    if (!user) throw new ConflictException(REGISTRATION_FAILED);
    return this.startSession(user);
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const credentials = await this.users.findCredentialsByEmail(input.email);
    const valid = credentials
      ? await this.passwords.verify(credentials.passwordHash, input.password)
      : await this.passwords.verifyDummy(input.password);
    if (!credentials || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return this.startSession(credentials.user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException(INVALID_SESSION);
    const session = await this.sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (!session) throw new UnauthorizedException(INVALID_SESSION);

    if (session.revokedAt) {
      await this.revokeFamilyOnReuse(session.familyId, session.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    const expiresAt = Math.min(session.expiresAt.getTime(), session.familyExpiresAt.getTime());
    if (expiresAt <= Date.now()) throw new UnauthorizedException(INVALID_SESSION);

    // Se relee el usuario para que el nuevo access token lleve su rol actual.
    const user = await this.users.findById(session.userId);
    if (!user) throw new UnauthorizedException(INVALID_SESSION);

    const { session: next, refreshToken: nextToken } = this.newSession(
      user.id,
      session.familyId,
      session.familyExpiresAt,
    );
    const rotated = await this.sessions.rotate(session.id, next);
    if (!rotated) {
      // Otra petición rotó este mismo token a la vez: es una reutilización.
      await this.revokeFamilyOnReuse(session.familyId, session.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    return { user, tokens: await this.buildTokens(user, nextToken, next.expiresAt) };
  }

  /** Idempotente: un token desconocido, caducado o ya revocado no es un error. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (session) await this.sessions.revokeFamily(session.familyId);
  }

  private async startSession(user: User): Promise<AuthResult> {
    const familyExpiresAt = new Date(Date.now() + MAX_SESSION_LIFETIME_SECONDS * 1000);
    const { session, refreshToken } = this.newSession(user.id, randomUUID(), familyExpiresAt);
    await this.sessions.create(session);
    return { user, tokens: await this.buildTokens(user, refreshToken, session.expiresAt) };
  }

  /** Cada token vale 30 días, pero nunca más allá de la caducidad absoluta de su familia. */
  private newSession(
    userId: string,
    familyId: string,
    familyExpiresAt: Date,
  ): { session: NewSession; refreshToken: string } {
    const refreshToken = generateRefreshToken();
    const expiresAt = Math.min(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000, familyExpiresAt.getTime());
    return {
      refreshToken,
      session: {
        id: randomUUID(),
        userId,
        familyId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(expiresAt),
        familyExpiresAt,
      },
    };
  }

  private async buildTokens(user: User, refreshToken: string, refreshExpiresAt: Date): Promise<AuthTokens> {
    const access = await this.accessTokens.sign({ id: user.id, role: user.role });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  private async revokeFamilyOnReuse(familyId: string, userId: string): Promise<void> {
    await this.sessions.revokeFamily(familyId);
    // Nunca se registra el token: solo identificadores para investigar el incidente.
    this.logger.warn(`Reutilización de refresh token: familia ${familyId} del usuario ${userId} revocada`);
  }
}
