/**
 * Constantes del transporte de autenticación que comparten API y clientes.
 * Los nombres de cookie llevan prefijo `__Host-` / `__Secure-` en producción (HTTPS):
 * el navegador solo las acepta si son Secure y, en `__Host-`, ligadas al host exacto.
 */
export const AUTH_COOKIES = {
  access: { secure: '__Host-rulet_at', insecure: 'rulet_at' },
  refresh: { secure: '__Secure-rulet_rt', insecure: 'rulet_rt' },
} as const;

/** Ruta a la que se limita la cookie de refresh: solo viaja a los endpoints de auth. */
export const REFRESH_COOKIE_PATH = '/v1/auth';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
