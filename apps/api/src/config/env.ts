import { z } from 'zod';

/**
 * Booleano estricto. NO se usa `z.coerce.boolean()` porque convierte cualquier cadena no vacía
 * (incluida `'false'`) en `true`: un `COOKIE_SECURE=false` acabaría activando lo contrario.
 */
const booleanFromString = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Prefijo del valor de ejemplo de `.env.example`: si llega a producción, es que nadie generó un secreto. */
const PLACEHOLDER_SECRET_PREFIX = 'cambia-esto';

/** Un origen válido es `esquema://host[:puerto]`, sin ruta ni barra final (así lo envía el navegador). */
function isValidOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

/**
 * Variables de la base de datos. Se exportan por separado porque el migrador
 * (`src/database/migrate.ts`) solo necesita estas y no debe exigir, p. ej., el secreto JWT.
 */
export const DatabaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    message: 'DATABASE_URL debe ser una URL postgres:// o postgresql://',
  }),
  DATABASE_SSL: booleanFromString.default(false),
  // Escape explícito para producción sin TLS hacia la BD (p. ej. red privada en docker compose local).
  DATABASE_SSL_ALLOW_INSECURE: booleanFromString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

export type DatabaseEnv = z.infer<typeof DatabaseEnvSchema>;

/** Regla común a la API y al migrador: en producción la conexión a la BD va cifrada salvo excepción explícita. */
export function checkDatabaseSsl(env: DatabaseEnv, ctx: z.RefinementCtx): void {
  if (env.NODE_ENV === 'production' && !env.DATABASE_SSL && !env.DATABASE_SSL_ALLOW_INSECURE) {
    ctx.addIssue({
      code: 'custom',
      path: ['DATABASE_SSL'],
      message:
        'En producción DATABASE_SSL debe ser true (o DATABASE_SSL_ALLOW_INSECURE=true de forma explícita)',
    });
  }
}

/**
 * Variables de entorno de la API. Se validan al arrancar: si falta algo o es inválido,
 * el proceso no arranca (fail fast) en lugar de fallar más tarde en producción.
 */
export const EnvSchema = z
  .object({
    ...DatabaseEnvSchema.shape,
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
      )
      .refine((origins) => origins.every(isValidOrigin), {
        message: 'CORS_ORIGINS debe ser una lista de orígenes (esquema://host[:puerto]) separados por comas',
      }),
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ISSUER: z.string().min(1).default('rulet-api'),
    JWT_AUDIENCE: z.string().min(1).default('rulet-clients'),
    // Sin valor: se decide según NODE_ENV en el `transform` final.
    COOKIE_SECURE: booleanFromString.optional(),
  })
  .superRefine((env, ctx) => {
    checkDatabaseSsl(env, ctx);
    if (env.NODE_ENV !== 'production') return;
    if (env.JWT_ACCESS_SECRET.startsWith(PLACEHOLDER_SECRET_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET es el valor de ejemplo: genera uno con `openssl rand -base64 48`',
      });
    }
    const insecure = env.CORS_ORIGINS.filter((origin) => {
      const url = new URL(origin);
      return url.protocol === 'http:' && !LOCALHOST_HOSTNAMES.has(url.hostname);
    });
    if (insecure.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: `En producción los orígenes deben ser https:// (salvo localhost): ${insecure.join(', ')}`,
      });
    }
  })
  .transform((env) => ({ ...env, COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production' }));

export type Env = z.output<typeof EnvSchema>;

function formatError(error: z.ZodError): string {
  return `Configuración de entorno inválida:\n${z.prettifyError(error)}`;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) throw new Error(formatError(result.error));
  return result.data;
}

/** Validación mínima para el migrador: solo las variables de la base de datos. */
export function validateDatabaseEnv(raw: Record<string, unknown>): DatabaseEnv {
  const result = DatabaseEnvSchema.superRefine(checkDatabaseSsl).safeParse(raw);
  if (!result.success) throw new Error(formatError(result.error));
  return result.data;
}
