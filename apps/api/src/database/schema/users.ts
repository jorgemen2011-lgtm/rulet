import { ROLES } from '@rulet/shared';
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Los valores del enum salen del dominio compartido: añadir un rol obliga a generar una migración. */
export const userRole = pgEnum('user_role', ROLES);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Se guarda ya normalizado (trim + minúsculas) por el contrato de @rulet/shared.
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
