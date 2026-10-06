import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, createNonce } from './csp';

const API_ORIGIN = 'https://api.rulet.app';

/** Convierte la cabecera en un mapa directiva → fuentes. */
function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name = '', ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );
}

describe('buildContentSecurityPolicy', () => {
  const production = parse(
    buildContentSecurityPolicy({
      nonce: 'abc123',
      isDev: false,
      apiOrigin: API_ORIGIN,
      upgradeInsecureRequests: true,
    }),
  );

  it('en producción solo permite scripts y estilos con nonce', () => {
    expect(production.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(production.get('style-src')).toEqual(["'self'", "'nonce-abc123'"]);
    const all = [...production.values()].flat();
    expect(all).not.toContain("'unsafe-inline'");
    expect(all).not.toContain("'unsafe-eval'");
  });

  it('fija las directivas restrictivas', () => {
    expect(production.get('default-src')).toEqual(["'self'"]);
    expect(production.get('connect-src')).toEqual(["'self'", API_ORIGIN]);
    expect(production.get('object-src')).toEqual(["'none'"]);
    expect(production.get('base-uri')).toEqual(["'self'"]);
    expect(production.get('form-action')).toEqual(["'self'"]);
    expect(production.get('frame-ancestors')).toEqual(["'none'"]);
    expect(production.get('upgrade-insecure-requests')).toEqual([]);
  });

  it('en desarrollo relaja eval y estilos inline, nunca a la vez que el nonce en estilos', () => {
    const dev = parse(
      buildContentSecurityPolicy({
        nonce: 'abc123',
        isDev: true,
        apiOrigin: 'http://localhost:3000',
        upgradeInsecureRequests: false,
      }),
    );
    expect(dev.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'", "'unsafe-eval'"]);
    expect(dev.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(dev.has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('createNonce', () => {
  it('genera 128 bits en base64, distintos en cada llamada', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});
