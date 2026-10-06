import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

function matches(url: string, headers?: Record<string, string>): boolean {
  return unstable_doesMiddlewareMatch({ config, url, headers });
}

describe('matcher del proxy', () => {
  it.each([
    '/',
    '/login',
    '/account?tab=1',
    '/no-existe',
    '/favicon.icox',
    '/favicon.ico/x',
    '/_next/staticx',
    '/_next/imagex',
  ])('aplica la CSP al documento %s', (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each(['/_next/static/chunks/main.js', '/_next/image?url=%2Flogo.png&w=64&q=75', '/favicon.ico'])(
    'omite el estático %s',
    (url) => {
      expect(matches(url)).toBe(false);
    },
  );

  it('omite las precargas de <Link>', () => {
    expect(matches('/account', { 'next-router-prefetch': '1' })).toBe(false);
    expect(matches('/account', { purpose: 'prefetch' })).toBe(false);
  });
});

describe('proxy', () => {
  it('fija la CSP con un nonce nuevo e ignora el que envíe el cliente', () => {
    const request = new NextRequest('https://rulet.app/login', {
      headers: { 'x-nonce': 'nonce-del-atacante', 'content-security-policy': "script-src 'unsafe-inline'" },
    });
    const response = proxy(request);

    const csp = response.headers.get('content-security-policy');
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe('nonce-del-atacante');
    expect(csp).toContain(`'nonce-${nonce}'`);
    // La CSP que Next lee de la petición es la misma que recibe el navegador.
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });
});
