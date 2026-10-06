import path from 'node:path';
import type { NextConfig } from 'next';
// Se importa por su efecto: valida las variables al cargar la configuración, de modo que `next build` falla con
// un mensaje claro en vez de generar una web que fallaría en cada petición.
import './src/lib/env';

/**
 * Cabeceras de seguridad estáticas, aplicadas a TODAS las respuestas (incluidos `_next/static` e imágenes).
 * La Content-Security-Policy NO va aquí: necesita un nonce distinto por petición y la fija `src/proxy.ts`.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Equivalente a `frame-ancestors 'none'` de la CSP, para navegadores antiguos que no la entienden.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Los navegadores solo la respetan si llega por HTTPS, así que no afecta al desarrollo en http://localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  // Aísla el contexto de navegación: una ventana abierta desde otro sitio no conserva `window.opener`.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Ningún otro sitio puede incrustar nuestros recursos (mitiga fugas tipo Spectre/XS-Leaks).
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Build autocontenido (.next/standalone) para desplegar en contenedor.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Los packages del monorepo se consumen como TS fuente.
  transpilePackages: ['@rulet/shared', '@rulet/api-client', '@rulet/design-tokens'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
