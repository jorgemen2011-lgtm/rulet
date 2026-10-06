import { validateDatabaseEnv, validateEnv } from './env.js';

const BASE = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};
const PROD = {
  ...BASE,
  NODE_ENV: 'production',
  DATABASE_SSL: 'true',
  CORS_ORIGINS: 'https://rulet.app',
  TRUST_PROXY: '1',
};

/** Secretos que están en el repositorio (públicos): nunca deben valer en producción. */
const COMMITTED_SECRETS = [
  'cambia-esto-por-un-secreto-generado-con-openssl-rand',
  'local-dev-only-insecure-jwt-secret-change-me-0123456789',
  'devcontainer-only-insecure-jwt-secret-0123456789abcdef',
  'ci-only-not-a-secret-0123456789abcdefghijklmnopqrstuvwxyz',
  'test-only-jwt-secret-do-not-use-anywhere-else-000000',
];

describe('validateEnv', () => {
  it('aplica valores por defecto seguros', () => {
    const env = validateEnv(BASE);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      DATABASE_SSL: false,
      DATABASE_POOL_MAX: 10,
      JWT_ISSUER: 'rulet-api',
      JWT_AUDIENCE: 'rulet-clients',
      COOKIE_SECURE: false,
      CORS_ORIGINS: ['http://localhost:3001'],
      TRUST_PROXY: ['loopback'],
    });
  });

  it('TRUST_PROXY admite saltos, false o una lista de IP/CIDR y subredes con nombre', () => {
    expect(validateEnv({ ...BASE, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(validateEnv({ ...BASE, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(
      validateEnv({ ...BASE, TRUST_PROXY: '10.0.0.0/8, 192.168.1.7,loopback,fd00::/8' }).TRUST_PROXY,
    ).toEqual(['10.0.0.0/8', '192.168.1.7', 'loopback', 'fd00::/8']);
    // `true` (confiar en cualquiera) permitiría a cualquier cliente elegir su IP.
    for (const value of ['true', '0', '11', '-1', '10.0.0.0/33', 'balanceador', '', ' , ']) {
      expect(() => validateEnv({ ...BASE, TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
    }
  });

  it('parsea booleanos de forma estricta ("false" es false)', () => {
    expect(validateEnv({ ...PROD, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(validateEnv({ ...BASE, COOKIE_SECURE: '1' }).COOKIE_SECURE).toBe(true);
    expect(() => validateEnv({ ...BASE, COOKIE_SECURE: 'yes' })).toThrow(/COOKIE_SECURE/);
  });

  it('COOKIE_SECURE es true por defecto en producción', () => {
    expect(validateEnv(PROD).COOKIE_SECURE).toBe(true);
  });

  it('exige secreto JWT de al menos 32 caracteres y URL postgres', () => {
    expect(() => validateEnv({ ...BASE, JWT_ACCESS_SECRET: 'corto' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...BASE, DATABASE_URL: 'mysql://u:p@h/db' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ JWT_ACCESS_SECRET: BASE.JWT_ACCESS_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('valida el formato de CORS_ORIGINS', () => {
    expect(validateEnv({ ...BASE, CORS_ORIGINS: 'http://a.test, https://b.test:8443' }).CORS_ORIGINS).toEqual(
      ['http://a.test', 'https://b.test:8443'],
    );
    expect(() => validateEnv({ ...BASE, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => validateEnv({ ...BASE, CORS_ORIGINS: 'https://rulet.app/' })).toThrow(/CORS_ORIGINS/);
  });

  describe('en producción', () => {
    it('exige TLS hacia la BD salvo excepción explícita', () => {
      expect(() => validateEnv({ ...PROD, DATABASE_SSL: 'false' })).toThrow(/DATABASE_SSL/);
      expect(
        validateEnv({ ...PROD, DATABASE_SSL: 'false', DATABASE_SSL_ALLOW_INSECURE: 'true' }),
      ).toBeTruthy();
    });

    it.each(COMMITTED_SECRETS)('rechaza el secreto público del repositorio %s', (secret) => {
      expect(() => validateEnv({ ...PROD, JWT_ACCESS_SECRET: secret })).toThrow(/JWT_ACCESS_SECRET/);
      // Fuera de producción siguen valiendo (son los de desarrollo, CI y tests).
      expect(validateEnv({ ...BASE, JWT_ACCESS_SECRET: secret }).JWT_ACCESS_SECRET).toBe(secret);
    });

    it('acepta un secreto generado', () => {
      const secret = 'q7Hk2vR9pLmX4sT8wZ1bN6cF3gJ0dY5eA+uK/oPiQ=';
      expect(validateEnv({ ...PROD, JWT_ACCESS_SECRET: secret }).JWT_ACCESS_SECRET).toBe(secret);
    });

    it('exige TRUST_PROXY explícita (sin valor por defecto)', () => {
      const { TRUST_PROXY: _omit, ...withoutTrustProxy } = PROD;
      expect(() => validateEnv(withoutTrustProxy)).toThrow(/TRUST_PROXY es obligatoria/);
      expect(validateEnv({ ...PROD, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    });

    it('exige CORS_ORIGINS explícita (sin el valor por defecto de desarrollo)', () => {
      const { CORS_ORIGINS: _omit, ...withoutCors } = PROD;
      expect(() => validateEnv(withoutCors)).toThrow(/CORS_ORIGINS es obligatoria/);
      expect(() => validateEnv({ ...PROD, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS es obligatoria/);
    });

    it('rechaza orígenes http:// (salvo localhost)', () => {
      expect(() => validateEnv({ ...PROD, CORS_ORIGINS: 'http://rulet.app' })).toThrow(/https:\/\//);
    });

    it('rechaza localhost salvo ALLOW_LOCALHOST_CORS=true', () => {
      for (const origin of ['http://localhost:3001', 'https://127.0.0.1', 'http://web.localhost']) {
        expect(() => validateEnv({ ...PROD, CORS_ORIGINS: `https://rulet.app,${origin}` })).toThrow(
          /ALLOW_LOCALHOST_CORS/,
        );
      }
      expect(
        validateEnv({ ...PROD, CORS_ORIGINS: 'http://localhost:3001', ALLOW_LOCALHOST_CORS: 'true' })
          .CORS_ORIGINS,
      ).toEqual(['http://localhost:3001']);
    });

    it('las variables de docker compose local (escapes explícitos) son válidas', () => {
      const env = validateEnv({
        ...PROD,
        JWT_ACCESS_SECRET: 'q7Hk2vR9pLmX4sT8wZ1bN6cF3gJ0dY5eA+uK/oPiQ=',
        DATABASE_SSL: 'false',
        DATABASE_SSL_ALLOW_INSECURE: 'true',
        CORS_ORIGINS: 'http://localhost:3001',
        ALLOW_LOCALHOST_CORS: 'true',
        TRUST_PROXY: 'false',
        COOKIE_SECURE: 'false',
      });
      expect(env).toMatchObject({ TRUST_PROXY: false, CORS_ORIGINS: ['http://localhost:3001'] });
    });
  });
});

describe('parámetros TLS en DATABASE_URL', () => {
  // `pg` aplica los de la URL por encima de `ssl`: podrían desactivar TLS o la verificación sin aviso.
  it.each([
    'sslmode=disable',
    'sslmode=no-verify',
    'sslmode=require',
    'uselibpqcompat=true&sslmode=require',
    'ssl=0',
  ])('rechaza ?%s aunque DATABASE_SSL=true', (query) => {
    const DATABASE_URL = `${BASE.DATABASE_URL}?${query}`;
    expect(() => validateEnv({ ...PROD, DATABASE_URL })).toThrow(/DATABASE_URL no puede llevar/);
    expect(() => validateDatabaseEnv({ DATABASE_URL, NODE_ENV: 'production', DATABASE_SSL: 'true' })).toThrow(
      /DATABASE_URL no puede llevar/,
    );
  });

  it('admite sslmode=verify-full y sslrootcert solo con DATABASE_SSL=true', () => {
    const DATABASE_URL = `${BASE.DATABASE_URL}?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem`;
    expect(validateEnv({ ...PROD, DATABASE_URL }).DATABASE_URL).toBe(DATABASE_URL);
    expect(() => validateEnv({ ...BASE, DATABASE_URL })).toThrow(/sslmode, sslrootcert/);
  });

  it('no afecta a otros parámetros de la URL', () => {
    const DATABASE_URL = `${BASE.DATABASE_URL}?application_name=x&connect_timeout=5`;
    expect(validateEnv({ ...BASE, DATABASE_URL }).DATABASE_URL).toBe(DATABASE_URL);
  });
});

describe('validateDatabaseEnv', () => {
  it('no exige variables ajenas a la BD (p. ej. el secreto JWT)', () => {
    expect(validateDatabaseEnv({ DATABASE_URL: BASE.DATABASE_URL }).DATABASE_URL).toBe(BASE.DATABASE_URL);
  });

  it('aplica la misma regla de TLS en producción', () => {
    expect(() => validateDatabaseEnv({ DATABASE_URL: BASE.DATABASE_URL, NODE_ENV: 'production' })).toThrow(
      /DATABASE_SSL/,
    );
  });
});
