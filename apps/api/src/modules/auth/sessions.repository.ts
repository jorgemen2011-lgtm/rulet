import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { type NewSessionRow, type SessionRow, sessions } from '../../database/schema/index.js';

export type NewSession = Required<
  Pick<NewSessionRow, 'id' | 'userId' | 'familyId' | 'tokenHash' | 'expiresAt' | 'familyExpiresAt'>
>;

/**
 * Espacio de claves de los bloqueos consultivos por familia (forma de dos claves `(int, int)`, que no se
 * solapa con la de una clave `bigint` del migrador). El valor es arbitrario pero fijo.
 */
const FAMILY_LOCK_NAMESPACE = 1_384_022_117;

/** Acceso a datos de las sesiones (refresh tokens). */
@Injectable()
export class SessionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(session: NewSession): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
    return row;
  }

  /**
   * Revoca la sesión `currentId` y crea `next` en una transacción. La revocación es condicional
   * (`revoked_at IS NULL`): si dos peticiones rotan el mismo token a la vez, solo una gana y la otra
   * recibe `false`, que el servicio trata como reutilización. Así nunca quedan dos tokens hijos válidos.
   */
  async rotate(currentId: string, next: NewSession): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await lockFamily(tx, next.familyId);
      const revoked = await tx
        .update(sessions)
        .set({ revokedAt: sql`now()`, replacedById: next.id })
        .where(and(eq(sessions.id, currentId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      if (revoked.length === 0) return false;
      await tx.insert(sessions).values(next);
      return true;
    });
  }

  /**
   * Revoca todas las sesiones activas de una familia (logout o reutilización detectada). Toma el mismo
   * bloqueo que `rotate`: sin él, un UPDATE concurrente con una rotación sin confirmar no vería la sesión
   * hija recién insertada y esta sobreviviría a la revocación.
   */
  async revokeFamily(familyId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await lockFamily(tx, familyId);
      await tx
        .update(sessions)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
    });
  }
}

/**
 * Serializa las escrituras de una familia hasta el final de la transacción. Un bloqueo consultivo y no
 * `SELECT ... FOR UPDATE` porque las filas de una familia crecen con cada rotación.
 */
async function lockFamily(tx: Pick<Database, 'execute'>, familyId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(${FAMILY_LOCK_NAMESPACE}::int, hashtext(${familyId}::text))`,
  );
}
