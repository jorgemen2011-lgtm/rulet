import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';
import { type New{{entityPascal}}Row, type {{entityPascal}}Row, {{nameCamel}} } from '../../database/schema/index.js';

// Tope de filas por listado: una respuesta sin límite es un vector de denegación de servicio.
const LIST_LIMIT = 100;

/**
 * Acceso a datos de `{{nameSnake}}`. Es la única pieza del módulo que conoce Drizzle.
 * Todas las consultas reciben el propietario y filtran por él: el aislamiento entre usuarios no depende de
 * que el servicio se acuerde de comprobarlo.
 */
@Injectable()
export class {{namePascal}}Repository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAllByOwner(userId: string): Promise<{{entityPascal}}Row[]> {
    return this.db
      .select()
      .from({{nameCamel}})
      .where(eq({{nameCamel}}.userId, userId))
      .orderBy(desc({{nameCamel}}.createdAt))
      .limit(LIST_LIMIT);
  }

  async findByIdForOwner(userId: string, id: string): Promise<{{entityPascal}}Row | undefined> {
    const [row] = await this.db
      .select()
      .from({{nameCamel}})
      .where(and(eq({{nameCamel}}.id, id), eq({{nameCamel}}.userId, userId)))
      .limit(1);
    return row;
  }

  async create(data: Pick<New{{entityPascal}}Row, 'userId' | 'name'>): Promise<{{entityPascal}}Row> {
    const [row] = await this.db.insert({{nameCamel}}).values(data).returning();
    // INSERT … RETURNING de una fila devuelve exactamente una o lanza; nunca un array vacío.
    if (!row) throw new Error('INSERT sin fila devuelta');
    return row;
  }
}
