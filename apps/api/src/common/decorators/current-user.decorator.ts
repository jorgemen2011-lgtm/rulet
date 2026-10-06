import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Role } from '@rulet/shared';
import type { Request } from 'express';

/** Identidad extraída del access token. Es lo único que el servidor sabe del usuario sin consultar la BD. */
export interface AuthUser {
  id: string;
  role: Role;
}

/** Petición tras pasar por JwtAuthGuard. */
export type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Inyecta el usuario autenticado: `me(@CurrentUser() user: AuthUser)`.
 * Si se usa por error en una ruta `@Public()` sin token, responde 401 en lugar de devolver `undefined`.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new UnauthorizedException('No autenticado');
  return user;
});
