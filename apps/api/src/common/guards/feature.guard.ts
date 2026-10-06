import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Feature, isFeatureAvailable } from '@rulet/shared';
import type { Request } from 'express';
import { platformFromRequest } from '../decorators/client-platform.decorator.js';

const FEATURE_KEY = 'rulet:feature';

/**
 * Restringe un controlador o ruta a las plataformas que tienen la funcionalidad
 * según el catálogo `FEATURES` de @rulet/shared. Ej.: `@RequireFeature('adminPanel')`.
 */
export const RequireFeature = (feature: Feature) => SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!feature) return true;

    const platform = platformFromRequest(ctx.switchToHttp().getRequest<Request>());
    if (!platform || !isFeatureAvailable(feature, platform)) {
      throw new ForbiddenException(`La funcionalidad "${feature}" no está disponible en esta plataforma`);
    }
    return true;
  }
}
