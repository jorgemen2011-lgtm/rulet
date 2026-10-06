/**
 * Validación de URLs con expresiones regulares en lugar de `URL`: la implementación de `URL`
 * de React Native ha sido incompleta históricamente y este paquete debe comportarse igual en todas partes.
 */

/** Hosts de desarrollo a los que se permite `http://` (10.0.2.2 es el host visto desde el emulador de Android). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

const BASE_URL_PATTERN = /^(https?):\/\/([^/?#\s]+)(\/[^?#\s]*)?$/i;

/** Normaliza `baseUrl` (sin barra final) y rechaza cualquier origen inseguro o ambiguo. */
export function resolveBaseUrl(baseUrl: string, allowInsecureHttp: boolean): string {
  const match = BASE_URL_PATTERN.exec(baseUrl.trim());
  if (!match) {
    throw new Error(
      `baseUrl inválida: "${baseUrl}". Debe ser una URL http(s) absoluta sin query ni fragmento.`,
    );
  }
  const protocol = (match[1] ?? '').toLowerCase();
  const authority = (match[2] ?? '').toLowerCase();
  const pathname = (match[3] ?? '').replace(/\/+$/, '');

  // Credenciales embebidas (`https://user:pass@host`) acabarían en logs y cabeceras: se rechazan.
  if (authority.includes('@')) {
    throw new Error('baseUrl no puede contener credenciales.');
  }
  if (protocol === 'http' && !allowInsecureHttp && !LOCAL_HOSTS.has(hostnameOf(authority))) {
    throw new Error(
      `baseUrl usa http:// con un host no local (${hostnameOf(authority)}): los tokens viajarían en claro. ` +
        'Usa https:// o, solo en entornos controlados, allowInsecureHttp: true.',
    );
  }
  return `${protocol}://${authority}${pathname}`;
}

function hostnameOf(authority: string): string {
  // IPv6 va entre corchetes; el puerto, si lo hay, sigue al último `:`.
  if (authority.startsWith('[')) {
    return authority.slice(0, authority.indexOf(']') + 1);
  }
  const colon = authority.lastIndexOf(':');
  return colon === -1 ? authority : authority.slice(0, colon);
}

/**
 * Comprueba que `path` es una ruta relativa al origen de la API. Impide que una ruta mal construida
 * (`//otro-host`, `\\`, `..`) haga viajar la sesión del usuario a otro sitio o a rutas no previstas.
 */
export function assertSafePath(path: string): void {
  const [pathname = ''] = path.split('?', 1);
  const valid =
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/[\s#\\]/.test(path) &&
    !pathname.split('/').some((segment) => segment === '.' || segment === '..');
  if (!valid) {
    throw new Error(`Ruta inválida: "${path}". Debe empezar por "/" y ser relativa a la API.`);
  }
}
