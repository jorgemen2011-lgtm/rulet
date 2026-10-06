import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@rulet/shared';
import { randomUUID } from 'node:crypto';
import type { SessionRow } from '../../database/schema/index.js';
import type { UserCredentials, UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { hashRefreshToken } from './refresh-token.js';
import type { NewSession, SessionsRepository } from './sessions.repository.js';

/** Repositorio en memoria con la misma semántica que el de Drizzle (rotación condicional incluida). */
class InMemorySessions implements Pick<SessionsRepository, keyof SessionsRepository> {
  readonly rows: SessionRow[] = [];

  async create(session: NewSession): Promise<void> {
    this.rows.push({ ...session, revokedAt: null, replacedById: null, createdAt: new Date() });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRow | undefined> {
    return this.rows.find((r) => r.tokenHash === tokenHash);
  }

  async rotate(currentId: string, next: NewSession): Promise<boolean> {
    const current = this.rows.find((r) => r.id === currentId && r.revokedAt === null);
    if (!current) return false;
    current.revokedAt = new Date();
    current.replacedById = next.id;
    await this.create(next);
    return true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const row of this.rows) if (row.familyId === familyId && !row.revokedAt) row.revokedAt = new Date();
  }

  active(familyId: string): SessionRow[] {
    return this.rows.filter((r) => r.familyId === familyId && !r.revokedAt);
  }
}

class InMemoryUsers implements Pick<UsersService, 'findById' | 'findCredentialsByEmail' | 'create'> {
  readonly rows = new Map<string, UserCredentials>();

  async findById(id: string): Promise<User | undefined> {
    return this.rows.get(id)?.user;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | undefined> {
    return [...this.rows.values()].find((c) => c.user.email === email);
  }

  async create(input: { email: string; passwordHash: string; name?: string }): Promise<User | undefined> {
    if (await this.findCredentialsByEmail(input.email)) return undefined;
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name ?? null,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    this.rows.set(user.id, { user, passwordHash: input.passwordHash });
    return user;
  }
}

const PASSWORD = 'una-contraseña-muy-larga';

function setup() {
  const sessions = new InMemorySessions();
  const users = new InMemoryUsers();
  const passwords = new PasswordHasher();
  const jwt = new JwtService({
    secret: 'unit-test-secret-at-least-32-characters-long',
    signOptions: { algorithm: 'HS256', expiresIn: 900 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const service = new AuthService(
    users as unknown as UsersService,
    sessions as unknown as SessionsRepository,
    passwords,
    new AccessTokenService(jwt),
  );
  return { service, sessions, users, passwords };
}

describe('AuthService', () => {
  describe('register', () => {
    it('guarda la contraseña con argon2id (nunca en claro) y abre una sesión', async () => {
      const { service, users, sessions } = setup();
      const result = await service.register({ email: 'ana@rulet.app', password: PASSWORD });

      const stored = users.rows.get(result.user.id);
      expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(stored?.passwordHash).not.toContain(PASSWORD);
      expect(sessions.rows).toHaveLength(1);
      // En BD solo está el hash del refresh token.
      expect(sessions.rows[0]?.tokenHash).toBe(hashRefreshToken(result.tokens.refreshToken));
      expect(sessions.rows[0]?.tokenHash).not.toBe(result.tokens.refreshToken);
    });

    it('email ya registrado → 409 con mensaje genérico', async () => {
      const { service } = setup();
      await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const attempt = service.register({ email: 'ana@rulet.app', password: PASSWORD });
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow('No se ha podido completar el registro');
    });
  });

  describe('login', () => {
    it('credenciales correctas → tokens', async () => {
      const { service } = setup();
      await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const result = await service.login({ email: 'ana@rulet.app', password: PASSWORD });
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toMatch(/^[\w-]{43}$/);
    });

    it('contraseña incorrecta y email inexistente dan el mismo error', async () => {
      const { service, passwords } = setup();
      await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const dummy = vi.spyOn(passwords, 'verifyDummy');

      const wrong = service.login({ email: 'ana@rulet.app', password: 'otra-contraseña' });
      await expect(wrong).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(wrong).rejects.toThrow('Credenciales inválidas');
      expect(dummy).not.toHaveBeenCalled();

      const unknown = service.login({ email: 'nadie@rulet.app', password: PASSWORD });
      await expect(unknown).rejects.toThrow('Credenciales inválidas');
      // Se verifica contra el hash ficticio para igualar tiempos.
      expect(dummy).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('rota: revoca el token usado y emite otro de la misma familia', async () => {
      const { service, sessions } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const second = await service.refresh(first.tokens.refreshToken);

      expect(second.tokens.refreshToken).not.toBe(first.tokens.refreshToken);
      const [old, current] = sessions.rows;
      expect(old?.revokedAt).toBeInstanceOf(Date);
      expect(old?.replacedById).toBe(current?.id);
      expect(current?.familyId).toBe(old?.familyId);
      expect(current?.revokedAt).toBeNull();
    });

    it('reutilizar un token ya rotado revoca TODA la familia', async () => {
      const { service, sessions } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const second = await service.refresh(first.tokens.refreshToken);
      const familyId = sessions.rows[0]!.familyId;

      await expect(service.refresh(first.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.active(familyId)).toHaveLength(0);
      // El token legítimo más reciente también queda invalidado.
      await expect(service.refresh(second.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('no afecta a otras familias (otros dispositivos)', async () => {
      const { service, sessions } = setup();
      const phone = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      const laptop = await service.login({ email: 'ana@rulet.app', password: PASSWORD });
      await service.refresh(phone.tokens.refreshToken);
      await expect(service.refresh(phone.tokens.refreshToken)).rejects.toThrow();

      const laptopFamily = sessions.rows.find(
        (r) => r.tokenHash === hashRefreshToken(laptop.tokens.refreshToken),
      )!.familyId;
      expect(sessions.active(laptopFamily)).toHaveLength(1);
    });

    it('si pierde una carrera de rotación, lo trata como reutilización', async () => {
      const { service, sessions } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      vi.spyOn(sessions, 'rotate').mockResolvedValueOnce(false);

      await expect(service.refresh(first.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.active(sessions.rows[0]!.familyId)).toHaveLength(0);
    });

    it('token caducado, desconocido o ausente → 401', async () => {
      const { service, sessions } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      sessions.rows[0]!.expiresAt = new Date(Date.now() - 1000);

      await expect(service.refresh(first.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh('desconocido')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('el access token nuevo lleva el rol actual del usuario', async () => {
      const { service, users } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      users.rows.get(first.user.id)!.user.role = 'admin';
      const second = await service.refresh(first.tokens.refreshToken);
      expect(second.user.role).toBe('admin');
    });
  });

  describe('logout', () => {
    it('revoca la familia del token y es idempotente', async () => {
      const { service, sessions } = setup();
      const first = await service.register({ email: 'ana@rulet.app', password: PASSWORD });
      await service.logout(first.tokens.refreshToken);
      expect(sessions.active(sessions.rows[0]!.familyId)).toHaveLength(0);

      await expect(service.logout(first.tokens.refreshToken)).resolves.toBeUndefined();
      await expect(service.logout('desconocido')).resolves.toBeUndefined();
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });
});
