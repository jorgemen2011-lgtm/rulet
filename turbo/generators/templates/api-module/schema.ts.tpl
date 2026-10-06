import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Tabla `{{nameSnake}}`. Cada fila pertenece a un usuario: el repositorio filtra SIEMPRE por `user_id`, así un
 * usuario no puede leer recursos ajenos aunque adivine su id (IDOR).
 * Tras cambiar este archivo: `pnpm --filter @rulet/api db:generate` y revisa el SQL generado en `drizzle/`.
 */
export const {{nameCamel}} = pgTable(
  '{{nameSnake}}',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('{{nameSnake}}_user_id_created_at_idx').on(t.userId, t.createdAt)],
);

export type {{entityPascal}}Row = typeof {{nameCamel}}.$inferSelect;
export type New{{entityPascal}}Row = typeof {{nameCamel}}.$inferInsert;
