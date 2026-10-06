import type { PoolConfig } from 'pg';
import type { DatabaseEnv } from '../config/env.js';

/** Configuración de conexión común a la API y al migrador. */
export function createPoolConfig(
  env: Pick<DatabaseEnv, 'DATABASE_URL' | 'DATABASE_SSL' | 'DATABASE_POOL_MAX'>,
): PoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    // Con TLS se verifica siempre el certificado del servidor: cifrar sin autenticar no evita un MITM.
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    application_name: 'rulet-api',
    // Fallar rápido si la BD no responde en lugar de acumular peticiones colgadas.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  };
}
