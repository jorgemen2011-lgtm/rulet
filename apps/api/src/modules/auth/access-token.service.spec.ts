import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS } from '@rulet/shared';
import { AccessTokenService } from './access-token.service.js';

const SECRET = 'unit-test-secret-at-least-32-characters-long';
const ISSUER = 'rulet-api';
const AUDIENCE = 'rulet-clients';
const USER = { id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b', role: 'admin' } as const;

const jwt = new JwtService({
  secret: SECRET,
  signOptions: {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
  },
  verifyOptions: { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE },
});
const service = new AccessTokenService(jwt);

/** Firma un token arbitrario con el mismo secreto para probar qué rechaza la verificación. */
function forge(payload: object, options: Parameters<JwtService['signAsync']>[1] = {}) {
  const raw = new JwtService({ secret: SECRET });
  return raw.signAsync(payload, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: 60,
    ...options,
  });
}

describe('AccessTokenService', () => {
  it('firma y verifica la identidad, con expiresAt coherente con exp', async () => {
    const { token, expiresAt } = await service.sign(USER);
    await expect(service.verify(token)).resolves.toEqual(USER);

    const decoded = jwt.decode<{ exp: number; iat: number; typ: string; iss: string; aud: string }>(token);
    expect(decoded).toMatchObject({ typ: 'access', iss: ISSUER, aud: AUDIENCE });
    expect(decoded.exp - decoded.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(expiresAt.getTime()).toBe(decoded.exp * 1000);
  });

  it('rechaza un JWT con otro typ (p. ej. un refresh firmado con el mismo secreto)', async () => {
    await expect(
      service.verify(await forge({ sub: USER.id, role: 'user', typ: 'refresh' })),
    ).resolves.toBeNull();
  });

  it('rechaza claims con forma inválida', async () => {
    await expect(
      service.verify(await forge({ sub: 'no-uuid', role: 'user', typ: 'access' })),
    ).resolves.toBeNull();
    await expect(
      service.verify(await forge({ sub: USER.id, role: 'root', typ: 'access' })),
    ).resolves.toBeNull();
  });

  it('rechaza emisor o audiencia distintos', async () => {
    const claims = { sub: USER.id, role: 'user', typ: 'access' };
    await expect(service.verify(await forge(claims, { issuer: 'otro' }))).resolves.toBeNull();
    await expect(service.verify(await forge(claims, { audience: 'otra' }))).resolves.toBeNull();
  });

  it('rechaza un token caducado', async () => {
    const claims = { sub: USER.id, role: 'user', typ: 'access', iat: Math.floor(Date.now() / 1000) - 120 };
    await expect(service.verify(await forge(claims, { expiresIn: 60 }))).resolves.toBeNull();
  });

  it('rechaza otro secreto y el algoritmo "none"', async () => {
    const claims = { sub: USER.id, role: 'user', typ: 'access' };
    const other = new JwtService({ secret: 'another-secret-also-at-least-32-characters' });
    const otherToken = await other.signAsync(claims, { issuer: ISSUER, audience: AUDIENCE });
    await expect(service.verify(otherToken)).resolves.toBeNull();

    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...claims, iss: ISSUER, aud: AUDIENCE })).toString('base64url');
    await expect(service.verify(`${header}.${body}.`)).resolves.toBeNull();
  });
});
