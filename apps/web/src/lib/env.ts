import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/** Hosts locales en los que se tolera `http://` también con NODE_ENV=production (build local, docker compose). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Origen de la API, sin versión (`https://api.rulet.app`). Se exige un origen "limpio" porque de él se derivan
 * la CSP (`connect-src`) y la URL base del cliente: credenciales, query o fragmento no tienen sentido aquí.
 */
const ApiUrlSchema = z.url({ protocol: /^https?$/ }).superRefine((value, ctx) => {
  const url = new URL(value);
  if (url.username || url.password) {
    ctx.addIssue({ code: 'custom', message: 'No puede incluir credenciales' });
  }
  if (url.search || url.hash) {
    ctx.addIssue({ code: 'custom', message: 'No puede incluir query ni fragmento' });
  }
  // En producción las cookies de sesión son `Secure`: sin HTTPS ni siquiera llegarían a enviarse.
  if (isProduction && url.protocol !== 'https:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    ctx.addIssue({ code: 'custom', message: 'En producción debe usar https://' });
  }
});

/** Variables públicas de la web. Next solo expone al navegador las que empiezan por NEXT_PUBLIC_. */
const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: ApiUrlSchema,
});

// Next sustituye cada `process.env.NEXT_PUBLIC_*` en build: hay que leerlas una a una.
const parsed = EnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});

if (!parsed.success) {
  // Mensaje legible en el log del build; nunca se llega a servir la app con una configuración inválida.
  throw new Error(`Variables de entorno inválidas en apps/web:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;

/** Origen (esquema + host + puerto) de la API, tal y como lo compara el navegador en CORS y CSP. */
export const apiOrigin = new URL(env.NEXT_PUBLIC_API_URL).origin;

/** Next fija NODE_ENV: `development` en `next dev`, `production` en `next build`/`next start`. */
export { isDevelopment, isProduction };
