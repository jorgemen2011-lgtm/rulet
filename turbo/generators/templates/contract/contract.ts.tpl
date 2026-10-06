import { z } from 'zod';

/**
 * Contrato HTTP de `/v1/{{name}}`. Fuente única de verdad: la API valida con estos esquemas y los clientes
 * tipan y validan las respuestas con ellos. Cambiar un campo aquí obliga a adaptar API y clientes en el mismo PR.
 */

/** Representación pública. Solo campos que puede ver el cliente: nunca el propietario ni datos internos. */
export const {{entityPascal}}Schema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// `strictObject`: se rechazan campos desconocidos (evita mass assignment, p. ej. un `userId` ajeno).
export const Create{{entityPascal}}RequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

export const {{entityPascal}}ListSchema = z.array({{entityPascal}}Schema);

export type {{entityPascal}} = z.infer<typeof {{entityPascal}}Schema>;
export type Create{{entityPascal}}Request = z.infer<typeof Create{{entityPascal}}RequestSchema>;
export type {{entityPascal}}List = z.infer<typeof {{entityPascal}}ListSchema>;
