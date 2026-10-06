import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Sesiones de refresh token. Nunca se guarda el token: solo su SHA-256, de modo que un volcado
 * de la tabla no permite suplantar a nadie. Cada rotación crea una fila nueva de la misma familia.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Agrupa todas las rotaciones de un mismo inicio de sesión (para revocarlas a la vez).
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Caducidad absoluta de la familia: se fija al iniciar sesión y se copia en cada rotación, de modo que
    // refrescar no alarga la sesión más allá de este límite (luego hay que volver a autenticarse).
    familyExpiresAt: timestamp('family_expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId), index('sessions_family_id_idx').on(t.familyId)],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
