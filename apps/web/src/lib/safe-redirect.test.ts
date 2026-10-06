import { describe, expect, it } from 'vitest';
import { DEFAULT_AFTER_LOGIN_PATH, buildLoginHref, safeRedirectPath } from './safe-redirect';

/** Cómo resolvería el navegador el destino desde una página de la web (lo que hace `router.replace`). */
function resolveFromLoginPage(path: string): URL {
  return new URL(path, 'https://rulet.app/login?next=x');
}

describe('safeRedirectPath', () => {
  it.each([
    ['/account', '/account'],
    ['/', '/'],
    ['/account?tab=perfil#datos', '/account?tab=perfil#datos'],
    ['/a/b/../c', '/a/c'],
    ['/./account', '/account'],
    ['/a//b', '/a//b'],
    ['/login-help', '/login-help'],
    ['/account?next=//evil.com', '/account?next=//evil.com'],
    ['/caf%C3%A9', '/caf%C3%A9'],
  ])('acepta la ruta interna %s', (value, expected) => {
    expect(safeRedirectPath(value)).toBe(expected);
  });

  it.each([
    'https://evil.com',
    'http://evil.com/account',
    // eslint-disable-next-line no-script-url -- es justo la entrada maliciosa que debe rechazarse
    'javascript:alert(1)',
    'data:text/html,hola',
    'account',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\u0000/evil.com',
    ' /account',
  ])('rechaza el destino externo o ambiguo %j', (value) => {
    expect(safeRedirectPath(value)).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  // WEB-01: el parser de URL elimina los segmentos de punto y deja un pathname '//evil.com'.
  it.each([
    '/.//evil.com',
    '/.//evil.com/login',
    '/a/..//evil.com',
    '/..//evil.com',
    '/%2e//evil.com',
    '/%2E//evil.com',
    '/%2e%2e//evil.com',
    '/x/%2e%2e//evil.com',
    '/x/.%2e//evil.com',
    '/./..//evil.com?x=1#y',
  ])('rechaza %j, que se normalizaría a una URL relativa al protocolo', (value) => {
    // Precondición: sin la validación de la ruta normalizada, este valor saldría del origen.
    expect(new URL(value, 'https://internal.invalid').pathname.startsWith('//')).toBe(true);
    expect(safeRedirectPath(value)).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it.each(['/login', '/register', '/login/', '/register/paso-2', '/login?next=/account', '/a/../login'])(
    'rechaza %j para no entrar en bucle',
    (value) => {
      expect(safeRedirectPath(value)).toBe(DEFAULT_AFTER_LOGIN_PATH);
    },
  );

  it.each([undefined, null, 42, ['/account'], {}, ''])('rechaza el valor no válido %j', (value) => {
    expect(safeRedirectPath(value)).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it('rechaza valores demasiado largos', () => {
    expect(safeRedirectPath(`/${'a'.repeat(2048)}`)).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it('usa el fallback indicado', () => {
    expect(safeRedirectPath('//evil.com', '/')).toBe('/');
  });

  it.each(['/account', '/a/b/../c?x=1#y', '/.//evil.com', '//evil.com', 'https://evil.com', '/login'])(
    'es idempotente y su resultado siempre se queda en el origen (%j)',
    (value) => {
      const once = safeRedirectPath(value);
      expect(safeRedirectPath(once)).toBe(once);
      expect(resolveFromLoginPage(once).origin).toBe('https://rulet.app');
    },
  );
});

describe('buildLoginHref', () => {
  it('añade `next` solo si es una ruta interna válida', () => {
    expect(buildLoginHref('/account?tab=1')).toBe('/login?next=%2Faccount%3Ftab%3D1');
    expect(buildLoginHref()).toBe('/login');
    expect(buildLoginHref('//evil.com')).toBe('/login');
    expect(buildLoginHref('/.//evil.com')).toBe('/login');
  });
});
