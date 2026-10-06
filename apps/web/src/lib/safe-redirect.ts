/** Destino tras autenticarse cuando no hay `next` o no es válido. */
export const DEFAULT_AFTER_LOGIN_PATH = '/account';

/** Rutas a las que nunca se redirige después de autenticarse: provocarían un bucle. */
const AUTH_PATHS = ['/login', '/register'];

const MAX_REDIRECT_LENGTH = 2048;

// Base ficticia solo para resolver la ruta; `.invalid` está reservado y nunca resuelve (RFC 2606).
const INTERNAL_BASE = 'https://internal.invalid';

/**
 * Devuelve `value` normalizado si es una ruta interna de la web; si no, `fallback`.
 *
 * Evita open redirects (`?next=https://evil.com`, `//evil.com`, `/\evil.com`, `javascript:`…): solo se aceptan
 * rutas relativas a la raíz que, resueltas por el mismo parser de URL que usa el navegador, sigan en este origen.
 */
export function safeRedirectPath(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN_PATH): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_REDIRECT_LENGTH) return fallback;
  // Exigir '/' inicial descarta esquemas (`javascript:`, `https:`) y rutas relativas al documento.
  if (!value.startsWith('/')) return fallback;
  // Los navegadores tratan '\' como '/' y descartan tabuladores y saltos de línea: '/\evil.com' o '/\t/evil.com'
  // acabarían siendo '//evil.com'. Se rechazan directamente en vez de intentar normalizarlos.
  if (value.includes('\\') || hasControlCharacters(value)) return fallback;
  if (value.startsWith('//')) return fallback;

  let url: URL;
  try {
    url = new URL(value, INTERNAL_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_BASE) return fallback;

  const isAuthPath = AUTH_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  if (isAuthPath) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Enlace a /login que, tras autenticarse, devuelve al usuario a `returnTo` (si es una ruta interna válida). */
export function buildLoginHref(returnTo?: string): string {
  const next = returnTo === undefined ? null : safeRedirectPath(returnTo, '');
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
