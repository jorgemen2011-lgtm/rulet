import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIES } from '@rulet/shared';
import { fakeRequest, httpContext } from '../../../test/support/http-context.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import { AccessTokenService } from '../../modules/auth/access-token.service.js';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'unit-test-secret-at-least-32-characters-long';
const USER = { id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b', role: 'user' } as const;

function setup() {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 900, issuer: 'rulet-api', audience: 'rulet-clients' },
    verifyOptions: { algorithms: ['HS256'], issuer: 'rulet-api', audience: 'rulet-clients' },
  });
  const tokens = new AccessTokenService(jwt);
  const config = { get: () => false } as unknown as AppConfigService;
  return { guard: new JwtAuthGuard(new Reflector(), tokens, config), tokens };
}

describe('JwtAuthGuard', () => {
  it('deja pasar las rutas @Public() sin token', async () => {
    const { guard } = setup();
    class PublicController {}
    Public()(PublicController);
    await expect(guard.canActivate(httpContext(fakeRequest(), undefined, PublicController))).resolves.toBe(
      true,
    );
  });

  it('rechaza con 401 si no hay token', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(httpContext(fakeRequest()))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta un Bearer válido y deja el usuario en la petición', async () => {
    const { guard, tokens } = setup();
    const { token } = await tokens.sign(USER);
    const req = fakeRequest({ headers: { authorization: `Bearer ${token}` } });
    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
    expect((req as AuthenticatedRequest).user).toEqual(USER);
  });

  it('acepta la cookie de access', async () => {
    const { guard, tokens } = setup();
    const { token } = await tokens.sign(USER);
    const req = fakeRequest({ cookies: { [AUTH_COOKIES.access.insecure]: token } });
    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
    expect((req as AuthenticatedRequest).user).toEqual(USER);
  });

  it('un Bearer inválido no cae a la cookie', async () => {
    const { guard, tokens } = setup();
    const { token } = await tokens.sign(USER);
    const req = fakeRequest({
      headers: { authorization: 'Bearer no-es-un-jwt' },
      cookies: { [AUTH_COOKIES.access.insecure]: token },
    });
    await expect(guard.canActivate(httpContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b'])('rechaza la cabecera mal formada "%s"', async (header) => {
    const { guard } = setup();
    const req = fakeRequest({ headers: { authorization: header } });
    await expect(guard.canActivate(httpContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
