import { z } from 'zod';

/**
 * Variables de entorno de la API. Se validan al arrancar: si falta algo o es inválido,
 * el proceso no arranca (fail fast) en lugar de fallar más tarde en producción.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_VERSION: z.string().default('0.0.0'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Configuración de entorno inválida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
