import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'rulet:isPublic';

/**
 * Marca una ruta o controlador como accesible sin access token.
 * Por defecto TODAS las rutas exigen autenticación (JwtAuthGuard global): lo público es la excepción explícita.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
