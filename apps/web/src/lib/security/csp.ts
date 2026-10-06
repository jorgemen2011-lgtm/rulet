import 'server-only';

/** Cabecera por la que el proxy pasa el nonce a los Server Components (p. ej. para `<Script nonce>`). */
export const NONCE_HEADER = 'x-nonce';

export interface CspOptions {
  /** Nonce de esta petición. Debe ser único e impredecible: se genera con `createNonce()`. */
  nonce: string;
  /** `next dev` necesita relajar algunas directivas (eval de React y estilos del overlay de errores). */
  isDev: boolean;
  /** Origen de la API, al que el navegador debe poder hacer `fetch`. */
  apiOrigin: string;
  /** Añade `upgrade-insecure-requests`. Solo tiene sentido cuando la web se sirve por HTTPS. */
  upgradeInsecureRequests: boolean;
}

/** 128 bits aleatorios en base64: imposible de adivinar por un atacante que inyecte HTML. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * CSP estricta basada en nonce (https://web.dev/articles/strict-csp):
 * - Scripts: solo los que llevan el nonce de la petición (Next lo añade a los suyos) y, con 'strict-dynamic',
 *   los que esos carguen. Con 'strict-dynamic' los navegadores modernos ignoran las listas de hosts y
 *   'unsafe-inline', así que un `<script>` inyectado sin nonce no se ejecuta.
 * - Estilos: hojas propias y `<style>` con nonce. Los atributos `style="…"` quedan bloqueados en producción,
 *   por eso la UI usa clases (CSS Modules) y nunca `style={{…}}`.
 * - Sin plugins, sin `<base>` ajeno, sin ser embebida en iframes y formularios solo hacia el propio origen.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
  apiOrigin,
  upgradeInsecureRequests,
}: CspOptions): string {
  const nonceSource = `'nonce-${nonce}'`;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React usa eval en desarrollo para reconstruir las pilas de error del servidor; nunca en producción.
    'script-src': ["'self'", nonceSource, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // En desarrollo el overlay de Next inyecta estilos sin nonce. Ojo: si hay nonce, el navegador ignora
    // 'unsafe-inline', por eso en desarrollo va uno u otro, no los dos.
    'style-src': ["'self'", isDev ? "'unsafe-inline'" : nonceSource],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    // 'self' incluye el WebSocket de recarga en caliente de `next dev` (mismo host).
    'connect-src': ["'self'", apiOrigin],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(' ')}`);
  if (upgradeInsecureRequests) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}
