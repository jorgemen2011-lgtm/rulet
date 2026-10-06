import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS, ROLES } from '@rulet/shared';
import { z } from 'zod';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';

/** Claims propios del access token. `iss`, `aud`, `exp` e `iat` los gestiona y verifica la librería JWT. */
const AccessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
  // Impide usar como access token cualquier otro JWT firmado con el mismo secreto.
  typ: z.literal('access'),
});

export interface SignedAccessToken {
  token: string;
  expiresAt: Date;
}

/**
 * Emite y verifica access tokens (JWT HS256, 15 min). El secreto, el algoritmo, `iss` y `aud`
 * se fijan en `JwtModule` (auth.module.ts); aquí se valida además la forma de los claims.
 */
@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}

  async sign(user: AuthUser): Promise<SignedAccessToken> {
    // Mismo cálculo que la librería (`iat` en segundos enteros) para que `expiresAt` coincida con `exp`.
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      typ: 'access',
      iat: issuedAtSeconds,
    });
    return { token, expiresAt: new Date((issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS) * 1000) };
  }

  /** Devuelve la identidad si el token es válido y `null` en cualquier otro caso (firma, caducidad, claims…). */
  async verify(token: string): Promise<AuthUser | null> {
    try {
      const payload: unknown = await this.jwt.verifyAsync(token);
      const claims = AccessTokenClaimsSchema.safeParse(payload);
      return claims.success ? { id: claims.data.sub, role: claims.data.role } : null;
    } catch {
      return null;
    }
  }
}
