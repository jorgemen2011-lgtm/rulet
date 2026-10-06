import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_COOKIES,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@rulet/shared';
import type { CookieOptions, Request, Response } from 'express';
import { isIP } from 'node:net';

/**
 * Cookies de autenticación del cliente web. En modo seguro (HTTPS) llevan prefijo `__Host-`/`__Secure-`,
 * que el navegador solo acepta con `Secure` (y en `__Host-`, sin `Domain` y con `Path=/`).
 * Nunca llevan `Domain`: quedan ligadas al host exacto de la API.
 */
export function accessCookieName(secure: boolean): string {
  return secure ? AUTH_COOKIES.access.secure : AUTH_COOKIES.access.insecure;
}

export function refreshCookieName(secure: boolean): string {
  return secure ? AUTH_COOKIES.refresh.secure : AUTH_COOKIES.refresh.insecure;
}

/** Todas las variantes: para CSRF da igual con qué configuración se emitió la cookie. */
export const AUTH_COOKIE_NAMES: readonly string[] = [
  AUTH_COOKIES.access.secure,
  AUTH_COOKIES.access.insecure,
  AUTH_COOKIES.refresh.secure,
  AUTH_COOKIES.refresh.insecure,
];

function accessCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

// `Strict` y limitada a /v1/auth: el refresh token solo viaja a los endpoints que lo necesitan.
function refreshCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: REFRESH_COOKIE_PATH };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
): void {
  // Express espera `maxAge` en milisegundos y emite `Max-Age` en segundos.
  res.cookie(accessCookieName(secure), tokens.accessToken, {
    ...accessCookieOptions(secure),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(refreshCookieName(secure), tokens.refreshToken, {
    ...refreshCookieOptions(secure),
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(accessCookieName(secure), accessCookieOptions(secure));
  res.clearCookie(refreshCookieName(secure), refreshCookieOptions(secure));
}

/**
 * Todos los valores con que llega una cookie. `req.cookies` (cookie-parser) se queda solo con el primero,
 * y un subdominio hermano puede plantar otra con el mismo nombre (`Domain=` del site padre y un `Path` más
 * largo, que el navegador envía antes): por eso se lee la cabecera en bruto. Sin cabecera (peticiones
 * construidas a mano), se usa lo que haya en `req.cookies`.
 */
function readCookieValues(req: Request, name: string): string[] {
  const header = req.headers?.cookie;
  if (typeof header !== 'string') {
    const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' && value.length > 0 ? [value] : [];
  }
  const values: string[] = [];
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1 || pair.slice(0, eq).trim() !== name) continue;
    const value = decodeCookieValue(pair.slice(eq + 1).trim());
    if (value.length > 0) values.push(value);
  }
  return values;
}

/** Mismo tratamiento que `cookie.parse`: comillas opcionales y codificación URI. */
function decodeCookieValue(raw: string): string {
  const value = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Una cookie de auth repetida es ambigua (posible cookie tossing): se trata como ausente. */
function readCookie(req: Request, name: string): string | undefined {
  const values = readCookieValues(req, name);
  return values.length === 1 ? values[0] : undefined;
}

export function readAccessCookie(req: Request, secure: boolean): string | undefined {
  return readCookie(req, accessCookieName(secure));
}

export function readRefreshCookie(req: Request, secure: boolean): string | undefined {
  return readCookie(req, refreshCookieName(secure));
}

// Tope de candidatos al revocar: la cabecera la controla el cliente y cada uno cuesta una consulta.
const MAX_REFRESH_COOKIE_CANDIDATES = 4;

/** Todos los refresh tokens recibidos (en logout se revocan todos, incluido el auténtico si está sombreado). */
export function readRefreshCookieCandidates(req: Request, secure: boolean): string[] {
  return readCookieValues(req, refreshCookieName(secure)).slice(0, MAX_REFRESH_COOKIE_CANDIDATES);
}

/**
 * Si la cookie de refresh llega repetida, emite su borrado para todos los `Path` y `Domain` con que el
 * navegador pudo enviarla a esta URL (prefijos de la ruta; el host y sus dominios padre). Así una cookie
 * plantada no deja la sesión rota indefinidamente. Devuelve si había duplicados.
 */
export function clearShadowedRefreshCookies(req: Request, res: Response, secure: boolean): boolean {
  const name = refreshCookieName(secure);
  if (readCookieValues(req, name).length <= 1) return false;
  for (const domain of cookieDomains(req.hostname)) {
    for (const path of cookiePaths(req.path)) {
      res.clearCookie(name, { ...refreshCookieOptions(secure), path, ...(domain && { domain }) });
    }
  }
  return true;
}

/** `Path` de cookie que coinciden con la ruta pedida: `/v1/auth/refresh` → `/`, `/v1`, `/v1/`, …, `/v1/auth/refresh`. */
function cookiePaths(requestPath: string): string[] {
  const paths = ['/'];
  let current = '';
  for (const segment of requestPath.split('/').filter(Boolean)) {
    if (current) paths.push(`${current}/`);
    current += `/${segment}`;
    paths.push(current);
  }
  return paths;
}

/** Cookie sin `Domain` (solo este host) más el host y cada dominio padre con al menos dos etiquetas. */
function cookieDomains(hostname: string | undefined): (string | undefined)[] {
  const domains: (string | undefined)[] = [undefined];
  if (!hostname || isIP(hostname) !== 0) return domains;
  const labels = hostname.split('.');
  for (let i = 0; i < labels.length - 1; i += 1) domains.push(labels.slice(i).join('.'));
  return domains;
}

/** Cualquier aparición cuenta (también las repetidas): para CSRF basta con que el navegador envíe cookies. */
export function hasAnyAuthCookie(req: Request): boolean {
  return AUTH_COOKIE_NAMES.some((name) => readCookieValues(req, name).length > 0);
}
