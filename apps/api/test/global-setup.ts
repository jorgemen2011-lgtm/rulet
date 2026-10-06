import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { e2eDatabaseUrl } from './test-env.js';

/** Aplica las migraciones a la BD de test. Se niega a tocar una BD cuyo nombre no termine en `_test`. */
export default async function setup(): Promise<void> {
  const database = new URL(e2eDatabaseUrl).pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Los e2e solo se ejecutan contra una BD *_test (recibido: "${database}")`);
  }
  const client = new Client({ connectionString: e2eDatabaseUrl });
  await client.connect();
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
  } finally {
    await client.end();
  }
}
