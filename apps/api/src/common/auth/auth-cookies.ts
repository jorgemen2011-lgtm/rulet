import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_COOKIES,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@rulet/shared';
import type { CookieOptions, Request, Response } from 'express';

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

function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function readAccessCookie(req: Request, secure: boolean): string | undefined {
  return readCookie(req, accessCookieName(secure));
}

export function readRefreshCookie(req: Request, secure: boolean): string | undefined {
  return readCookie(req, refreshCookieName(secure));
}

export function hasAnyAuthCookie(req: Request): boolean {
  return AUTH_COOKIE_NAMES.some((name) => readCookie(req, name) !== undefined);
}
