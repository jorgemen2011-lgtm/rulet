import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit no carga `.env` por sí mismo. Las variables ya definidas en el entorno tienen prioridad.
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * Configuración de drizzle-kit (solo herramientas de desarrollo):
 * - `pnpm db:generate` compara `src/database/schema` con las migraciones y genera el SQL nuevo en `drizzle/`.
 * - `pnpm db:migrate` / `pnpm db:studio` usan `DATABASE_URL`.
 * En producción las migraciones se aplican con `node dist/database/migrate.js`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  // `generate` no se conecta a la BD, así que no exige la variable.
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
