import { ForbiddenException } from '@nestjs/common';
import { AUTH_COOKIES } from '@rulet/shared';
import { fakeRequest, httpContext } from '../../../test/support/http-context.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import { CsrfGuard } from './csrf.guard.js';

const ALLOWED = 'https://rulet.app';
const config = { get: () => [ALLOWED] } as unknown as AppConfigService;
const guard = new CsrfGuard(config);
const withCookie = { cookies: { [AUTH_COOKIES.refresh.secure]: 'token' } };

describe('CsrfGuard', () => {
  it('no afecta a métodos seguros', () => {
    const req = fakeRequest({ method: 'GET', ...withCookie, headers: { origin: 'https://evil.example' } });
    expect(guard.canActivate(httpContext(req))).toBe(true);
  });

  it('no afecta a peticiones sin cookies de auth (móvil)', () => {
    const req = fakeRequest({ method: 'POST' });
    expect(guard.canActivate(httpContext(req))).toBe(true);
  });

  it('permite POST con cookie y Origin de la lista blanca', () => {
    const req = fakeRequest({ method: 'POST', ...withCookie, headers: { origin: ALLOWED } });
    expect(guard.canActivate(httpContext(req))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rechaza %s con cookie y Origin ajeno', (method) => {
    const req = fakeRequest({ method, ...withCookie, headers: { origin: 'https://evil.example' } });
    expect(() => guard.canActivate(httpContext(req))).toThrow(ForbiddenException);
  });

  it('rechaza POST con cookie y sin Origin', () => {
    const req = fakeRequest({ method: 'POST', ...withCookie });
    expect(() => guard.canActivate(httpContext(req))).toThrow(ForbiddenException);
  });

  it('detecta también las cookies sin prefijo (desarrollo)', () => {
    const req = fakeRequest({ method: 'POST', cookies: { [AUTH_COOKIES.access.insecure]: 'x' } });
    expect(() => guard.canActivate(httpContext(req))).toThrow(ForbiddenException);
  });
});
