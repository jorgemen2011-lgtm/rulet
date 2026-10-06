import { z } from 'zod';
import { ROLES } from '../domain/roles';

/** Representación pública de un usuario. Nunca incluye datos sensibles (hash de contraseña, tokens). */
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().nullable(),
  role: z.enum(ROLES),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
