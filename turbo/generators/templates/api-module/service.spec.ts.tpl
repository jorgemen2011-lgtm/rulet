import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { {{entityPascal}}Schema } from '@rulet/shared';
import type { {{entityPascal}}Row } from '../../database/schema/index.js';
import { {{namePascal}}Repository } from './{{name}}.repository.js';
import { {{namePascal}}Service } from './{{name}}.service.js';

const OWNER_ID = '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b';

const row: {{entityPascal}}Row = {
  id: '0b6e2a8c-1d3f-4a5b-9c7d-8e9f0a1b2c3d',
  userId: OWNER_ID,
  name: 'Ejemplo',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

async function setup() {
  const repository = {
    findAllByOwner: vi.fn<{{namePascal}}Repository['findAllByOwner']>(),
    findByIdForOwner: vi.fn<{{namePascal}}Repository['findByIdForOwner']>(),
    create: vi.fn<{{namePascal}}Repository['create']>(),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [{{namePascal}}Service, { provide: {{namePascal}}Repository, useValue: repository }],
  }).compile();
  return { service: moduleRef.get({{namePascal}}Service), repository };
}

describe('{{namePascal}}Service', () => {
  it('lista solo lo del propietario y cumple el contrato (sin exponer userId)', async () => {
    const { service, repository } = await setup();
    repository.findAllByOwner.mockResolvedValue([row]);

    const [item] = await service.list(OWNER_ID);

    expect(repository.findAllByOwner).toHaveBeenCalledWith(OWNER_ID);
    expect({{entityPascal}}Schema.safeParse(item).success).toBe(true);
    expect(item).not.toHaveProperty('userId');
  });

  it('responde 404 si el recurso no existe o es de otro usuario', async () => {
    const { service, repository } = await setup();
    repository.findByIdForOwner.mockResolvedValue(undefined);

    await expect(service.get(OWNER_ID, row.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findByIdForOwner).toHaveBeenCalledWith(OWNER_ID, row.id);
  });

  it('crea el recurso a nombre del usuario autenticado', async () => {
    const { service, repository } = await setup();
    repository.create.mockResolvedValue(row);

    const created = await service.create(OWNER_ID, { name: 'Ejemplo' });

    expect(repository.create).toHaveBeenCalledWith({ userId: OWNER_ID, name: 'Ejemplo' });
    expect(created.id).toBe(row.id);
  });
});
