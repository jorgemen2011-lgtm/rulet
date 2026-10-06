import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service.js';
import { createPoolConfig } from './pool-config.js';
import * as schema from './schema/index.js';

/** Token de inyección de la instancia Drizzle: `@Inject(DATABASE) private readonly db: Database`. */
export const DATABASE = Symbol('DATABASE');
export const DATABASE_POOL = Symbol('DATABASE_POOL');

export type Database = NodePgDatabase<typeof schema>;

/**
 * Conexión a PostgreSQL. Global para que cualquier repositorio pueda inyectar `DATABASE`
 * sin importar el módulo. Solo los repositorios deben hacerlo (Controller → Service → Repository).
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Pool => {
        const pool = new Pool(
          createPoolConfig({
            DATABASE_URL: config.get('DATABASE_URL'),
            DATABASE_SSL: config.get('DATABASE_SSL'),
            DATABASE_POOL_MAX: config.get('DATABASE_POOL_MAX'),
          }),
        );
        // Sin este manejador, un error en una conexión inactiva (p. ej. reinicio de la BD) tumbaría el proceso.
        pool.on('error', (err) =>
          new Logger('Database').error(`Error en una conexión inactiva: ${err.message}`),
        );
        return pool;
      },
    },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Database => drizzle({ client: pool, schema }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
