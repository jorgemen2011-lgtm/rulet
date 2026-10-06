/**
 * Entorno de los tests. Valores FICTICIOS, solo válidos en local/CI: nunca se usan fuera de los tests.
 * La URL de la BD e2e se puede sobrescribir con `TEST_DATABASE_URL` (p. ej. en CI).
 */
const TEST_JWT_SECRET = 'test-only-jwt-secret-do-not-use-anywhere-else-000000';

const common = {
  NODE_ENV: 'test',
  CORS_ORIGINS: 'http://localhost:3001',
  JWT_ACCESS_SECRET: TEST_JWT_SECRET,
};

/** Tests unitarios: no se conectan a ninguna BD (el pool de `pg` es perezoso), pero la config la exige. */
export const unitTestEnv: Record<string, string> = {
  ...common,
  DATABASE_URL: 'postgres://unit:unit@127.0.0.1:5432/unit_tests_do_not_connect',
};

export const e2eDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://rulet:rulet@localhost:5432/rulet_test';

export const e2eTestEnv: Record<string, string> = {
  ...common,
  DATABASE_URL: e2eDatabaseUrl,
};
