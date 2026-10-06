import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../config/app-config.service.js';
import { AccessTokenService } from '../../modules/auth/access-token.service.js';
import { readAccessCookie } from '../auth/auth-cookies.js';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard GLOBAL: exige un access token válido en todas las rutas salvo las `@Public()`.
 * Acepta `Authorization: Bearer` (móvil) o la cookie httpOnly de access (web).
 * Si llega cabecera Authorization se usa solo esa: un Bearer inválido no cae a la cookie.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No autenticado');

    const user = await this.accessTokens.verify(token);
    if (!user) throw new UnauthorizedException('Token inválido o caducado');

    req.user = user;
    return true;
  }

  private extractToken(req: AuthenticatedRequest): string | undefined {
    const header = req.header('authorization');
    if (header !== undefined) {
      const [scheme, value, ...rest] = header.split(' ');
      return scheme?.toLowerCase() === 'bearer' && value && rest.length === 0 ? value : undefined;
    }
    return readAccessCookie(req, this.config.get('COOKIE_SECURE'));
  }
}
