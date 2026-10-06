import { z } from 'zod';

/** Forma única de todos los errores que devuelve la API. */
export const ApiErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  path: z.string(),
  requestId: z.string().optional(),
  timestamp: z.iso.datetime(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
