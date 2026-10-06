import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service.js';
import { hasAnyAuthCookie } from '../auth/auth-cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard GLOBAL anti-CSRF para el cliente web (autenticado por cookies).
 * Si una petición que modifica estado trae cookies de auth, su `Origin` debe estar en `CORS_ORIGINS`.
 * Es defensa en profundidad junto a `SameSite` y a la cabecera `x-client-platform` (que fuerza preflight CORS).
 * Las peticiones móviles no llevan cookies y no se ven afectadas.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: AppConfigService) {
    this.allowedOrigins = new Set(config.get('CORS_ORIGINS'));
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method) || !hasAnyAuthCookie(req)) return true;

    const origin = req.header('origin');
    if (!origin || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origen no permitido');
    }
    return true;
  }
}
