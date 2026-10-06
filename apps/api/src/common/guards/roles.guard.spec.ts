import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fakeRequest, httpContext } from '../../../test/support/http-context.js';
import type { AuthenticatedRequest, AuthUser } from '../decorators/current-user.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class AdminController {}
Roles('admin')(AdminController);

function requestAs(user?: AuthUser) {
  const req = fakeRequest() as AuthenticatedRequest;
  req.user = user;
  return req;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deja pasar las rutas sin @Roles', () => {
    expect(guard.canActivate(httpContext(requestAs({ id: 'u1', role: 'user' })))).toBe(true);
  });

  it('deja pasar a un usuario con el rol exigido', () => {
    const ctx = httpContext(requestAs({ id: 'u1', role: 'admin' }), undefined, AdminController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza con 403 a un usuario sin el rol', () => {
    const ctx = httpContext(requestAs({ id: 'u1', role: 'user' }), undefined, AdminController);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 si no hay usuario (nunca abre por defecto)', () => {
    const ctx = httpContext(requestAs(undefined), undefined, AdminController);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
