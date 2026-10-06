import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { validateDatabaseEnv } from '../config/env.js';
import { createPoolConfig } from './pool-config.js';

/**
 * Aplica las migraciones SQL de `apps/api/drizzle/` y termina.
 * Es un paso explícito del despliegue (`node dist/database/migrate.js`), nunca se ejecuta al arrancar
 * la API: así varias réplicas no compiten por migrar y un fallo de migración no tumba el servicio.
 */

// Ruta relativa a este archivo: vale igual desde `src/` (tsx) que desde `dist/` (compilado).
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
// Clave arbitraria pero fija: serializa migradores lanzados a la vez (p. ej. dos despliegues solapados).
const MIGRATION_LOCK_KEY = 728_391_204;

const logger = new Logger('Migrate');

async function run(): Promise<void> {
  const env = validateDatabaseEnv(process.env);
  // Un único cliente (no pool): el bloqueo consultivo pertenece a la conexión que migra.
  const client = new Client(createPoolConfig(env));
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
    logger.log('Migraciones aplicadas');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}

try {
  await run();
} catch (err) {
  // Solo el mensaje: el error de `pg` nunca incluye la contraseña, pero evitamos volcar la configuración.
  logger.error(`Error aplicando migraciones: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
