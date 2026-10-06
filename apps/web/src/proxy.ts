import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiOrigin, isDevelopment, isProduction } from '@/lib/env';
import { NONCE_HEADER, buildContentSecurityPolicy, createNonce } from '@/lib/security/csp';

const CSP_HEADER = 'Content-Security-Policy';

/**
 * Genera un nonce por petición y fija la CSP. Next lee la CSP de la cabecera de la PETICIÓN para extraer el
 * nonce y añadirlo a sus `<script>`; la de la RESPUESTA es la que aplica el navegador.
 *
 * Aquí no se comprueba la sesión: las cookies de auth pertenecen al host de la API y este servidor no las
 * recibe. La autorización la hace siempre la API.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: isDevelopment,
    apiOrigin,
    // Solo en despliegues reales (API por HTTPS). En `docker compose` local todo es http://localhost y
    // forzar HTTPS rompería la carga de recursos.
    upgradeInsecureRequests: isProduction && apiOrigin.startsWith('https:'),
  });

  // Se sobrescriben siempre: un cliente no puede colar su propio nonce ni su propia CSP.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Solo documentos HTML: los estáticos con hash no ejecutan nada y no necesitan CSP propia. Las exclusiones
      // van ancladas (directorio `_next/static/`, rutas exactas `/_next/image` y `/favicon.ico`) para que una
      // ruta que solo comparta el prefijo (`/favicon.icox`, `/_next/staticx`) siga recibiendo la CSP.
      source: '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
      // Las precargas de <Link> no son documentos: se omiten para no generar nonces inútiles.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
