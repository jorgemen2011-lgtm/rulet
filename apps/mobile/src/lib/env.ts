import { z } from 'zod';

/** Variables públicas de la app. Expo solo expone las que empiezan por EXPO_PUBLIC_. */
const EnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
});

// Expo sustituye cada `process.env.EXPO_PUBLIC_*` en build: hay que leerlas una a una.
export const env = EnvSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
});
