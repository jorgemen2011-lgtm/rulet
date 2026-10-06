import { SetMetadata } from '@nestjs/common';
import type { Role } from '@rulet/shared';

export const ROLES_KEY = 'rulet:roles';

/** Restringe una ruta o controlador a los roles indicados (403 si no). Ej.: `@Roles('admin')`. */
export const Roles = (...roles: [Role, ...Role[]]) => SetMetadata(ROLES_KEY, roles);
