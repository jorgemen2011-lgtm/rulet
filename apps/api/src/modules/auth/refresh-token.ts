import { createHash, randomBytes } from 'node:crypto';

/** Refresh token opaco: 32 bytes aleatorios (256 bits) en base64url. No es un JWT: solo vale contra la BD. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * En la BD solo se guarda el SHA-256 del token. Basta un hash rápido sin sal (a diferencia de
 * las contraseñas) porque el token tiene 256 bits de entropía: no se puede atacar por diccionario.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
