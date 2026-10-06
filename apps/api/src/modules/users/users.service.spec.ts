import { UserSchema } from '@rulet/shared';
import type { UserRow } from '../../database/schema/index.js';
import { toPublicUser } from './users.service.js';

describe('toPublicUser', () => {
  it('expone solo los campos públicos (nunca el hash) y cumple el contrato User', () => {
    const row: UserRow = {
      id: '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b',
      email: 'ana@rulet.app',
      passwordHash: '$argon2id$secreto',
      name: null,
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    const user = toPublicUser(row);
    expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role']);
    expect(UserSchema.safeParse(user).success).toBe(true);
  });
});
