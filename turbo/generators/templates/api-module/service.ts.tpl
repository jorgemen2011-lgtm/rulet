import { Injectable, NotFoundException } from '@nestjs/common';
import type { {{entityPascal}}, Create{{entityPascal}}Request } from '@rulet/shared';
import type { {{entityPascal}}Row } from '../../database/schema/index.js';
import { {{namePascal}}Repository } from './{{name}}.repository.js';

/** Proyección pública: lista blanca explícita de campos. Nunca expone el propietario ni columnas internas. */
export function toPublic{{entityPascal}}(row: {{entityPascal}}Row): {{entityPascal}} {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lógica de negocio de {{name}}. Recibe la identidad ya verificada (`ownerId`) desde el controller. */
@Injectable()
export class {{namePascal}}Service {
  constructor(private readonly repository: {{namePascal}}Repository) {}

  async list(ownerId: string): Promise<{{entityPascal}}[]> {
    const rows = await this.repository.findAllByOwner(ownerId);
    return rows.map(toPublic{{entityPascal}});
  }

  async get(ownerId: string, id: string): Promise<{{entityPascal}}> {
    const row = await this.repository.findByIdForOwner(ownerId, id);
    // Mismo 404 si no existe o si es de otro usuario: no se revela qué ids existen.
    if (!row) throw new NotFoundException('Recurso no encontrado');
    return toPublic{{entityPascal}}(row);
  }

  async create(ownerId: string, input: Create{{entityPascal}}Request): Promise<{{entityPascal}}> {
    const row = await this.repository.create({ userId: ownerId, name: input.name });
    return toPublic{{entityPascal}}(row);
  }
}
