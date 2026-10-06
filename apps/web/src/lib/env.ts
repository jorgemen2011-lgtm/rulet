import { z } from 'zod';

/** Variables públicas de la web. Next solo expone al navegador las que empiezan por NEXT_PUBLIC_. */
const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

// Next sustituye cada `process.env.NEXT_PUBLIC_*` en build: hay que leerlas una a una.
export const env = EnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});
