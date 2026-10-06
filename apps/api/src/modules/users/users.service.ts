import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@rulet/shared';
import type { UserRow } from '../../database/schema/index.js';
import { UsersRepository } from './users.repository.js';

/** Usuario con su hash de contraseña. Solo lo consume AuthService; nunca sale por HTTP. */
export interface UserCredentials {
  user: User;
  passwordHash: string;
}

/** Proyección pública: lo que se expone por HTTP. Lista blanca explícita de campos (nunca el hash). */
export function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async findById(id: string): Promise<User | undefined> {
    const row = await this.users.findById(id);
    return row && toPublicUser(row);
  }

  /** Perfil del usuario autenticado. */
  async getProfile(id: string): Promise<User> {
    const user = await this.findById(id);
    // Token válido de un usuario ya borrado: se trata como sesión inválida para que el cliente la cierre.
    if (!user) throw new UnauthorizedException('Sesión no válida');
    return user;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | undefined> {
    const row = await this.users.findByEmail(email);
    return row && { user: toPublicUser(row), passwordHash: row.passwordHash };
  }

  /** Crea un usuario con rol por defecto. Devuelve `undefined` si el email ya está registrado. */
  async create(input: { email: string; passwordHash: string; name?: string }): Promise<User | undefined> {
    const row = await this.users.create({
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
    });
    return row && toPublicUser(row);
  }
}
