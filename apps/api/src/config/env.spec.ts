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
};

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
    });
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

    it('rechaza el secreto de ejemplo de .env.example', () => {
      expect(() =>
        validateEnv({ ...PROD, JWT_ACCESS_SECRET: 'cambia-esto-por-un-secreto-generado-con-openssl-rand' }),
      ).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('rechaza orígenes http:// salvo localhost', () => {
      expect(() => validateEnv({ ...PROD, CORS_ORIGINS: 'http://rulet.app' })).toThrow(/CORS_ORIGINS/);
      expect(validateEnv({ ...PROD, CORS_ORIGINS: 'http://localhost:3001' }).CORS_ORIGINS).toEqual([
        'http://localhost:3001',
      ]);
    });
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
