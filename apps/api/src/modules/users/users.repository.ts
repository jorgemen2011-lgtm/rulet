import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { type NewUserRow, type UserRow, users } from '../../database/schema/index.js';

/** Acceso a datos de usuarios. Es la única pieza del módulo que conoce Drizzle. */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row;
  }

  /**
   * Inserta el usuario o devuelve `undefined` si el email ya existe. Se apoya en la restricción UNIQUE
   * (no en un SELECT previo) para ser correcto también con registros simultáneos.
   */
  async create(data: Pick<NewUserRow, 'email' | 'passwordHash' | 'name'>): Promise<UserRow | undefined> {
    const [row] = await this.db
      .insert(users)
      .values(data)
      .onConflictDoNothing({ target: users.email })
      .returning();
    return row;
  }
}
