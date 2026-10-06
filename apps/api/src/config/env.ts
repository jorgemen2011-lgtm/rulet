import { isIP } from 'node:net';
import { z } from 'zod';

/**
 * Booleano estricto. NO se usa `z.coerce.boolean()` porque convierte cualquier cadena no vacía
 * (incluida `'false'`) en `true`: un `COOKIE_SECURE=false` acabaría activando lo contrario.
 */
const booleanFromString = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLocalhost(url: URL): boolean {
  return LOCALHOST_HOSTNAMES.has(url.hostname) || url.hostname.endsWith('.localhost');
}

/** Origen del cliente web en desarrollo. Solo es el valor por defecto fuera de producción. */
const DEV_CORS_ORIGINS = ['http://localhost:3001'];

/**
 * Marcadores de los secretos de ejemplo y de los que están en el repositorio (`.env.example`, docker compose,
 * devcontainer, CI, tests). Son públicos: si llegan a producción, cualquiera podría firmar access tokens.
 */
const DEV_SECRET_MARKERS = /insecure|not-a-secret|dev-only|devcontainer|test-only|cambia-esto|change-me/i;

/** Nombres de subredes que entiende Express en `trust proxy`. */
const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);
const MAX_TRUST_PROXY_HOPS = 10;

function isIpOrCidr(value: string): boolean {
  const [address = '', prefix, ...rest] = value.split('/');
  const version = isIP(address);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  return /^\d{1,3}$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128);
}

/**
 * Qué proxies se consideran de confianza para leer la IP del cliente de `X-Forwarded-For` (`req.ip`, que
 * es la clave del rate limiting). Debe reflejar la topología real: si se confía en más saltos de los que
 * hay, el cliente elige su IP y elude los límites; si se confía en menos, todos comparten la IP del proxy.
 * - `false`: tráfico directo, sin proxy (se ignora `X-Forwarded-For`).
 * - `N` (1–10): número de proxies delante de la API (p. ej. 1 tras un único balanceador).
 * - Lista separada por comas de IP, CIDR o `loopback`/`linklocal`/`uniquelocal`: direcciones de los proxies.
 */
const TrustProxySchema = z
  .string()
  .trim()
  .transform((value, ctx): false | number | string[] => {
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) {
      const hops = Number(value);
      if (hops >= 1 && hops <= MAX_TRUST_PROXY_HOPS) return hops;
    } else {
      const entries = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (entries.length > 0 && entries.every((e) => TRUST_PROXY_PRESETS.has(e) || isIpOrCidr(e))) {
        return entries;
      }
    }
    ctx.addIssue({
      code: 'custom',
      message: `TRUST_PROXY debe ser 'false', un número de saltos (1-${MAX_TRUST_PROXY_HOPS}) o una lista de IP/CIDR o loopback/linklocal/uniquelocal separadas por comas`,
    });
    return z.NEVER;
  });

/**
 * Parámetros de DATABASE_URL que `pg` aplica POR ENCIMA de la opción `ssl` (pool-config.ts) y que pueden
 * desactivar TLS o la verificación del certificado (p. ej. `ssl=0`, `uselibpqcompat=true&sslmode=require`).
 */
const URL_TLS_OVERRIDE_PARAMS = new Set(['ssl', 'sslnegotiation', 'uselibpqcompat']);
/** Parámetros compatibles con TLS verificado (CA propia, certificado de cliente): solo con DATABASE_SSL=true. */
const URL_TLS_VERIFIED_PARAMS = new Set(['sslrootcert', 'sslcert', 'sslkey']);

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

/** En producción la conexión a la BD va cifrada salvo excepción explícita. */
function checkDatabaseSsl(env: DatabaseEnv, ctx: z.RefinementCtx): void {
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
 * DATABASE_SSL es la única fuente de verdad sobre TLS: se rechazan los parámetros de la URL que la
 * contradirían en silencio (`?sslmode=disable` o `no-verify` con DATABASE_SSL=true pasaría la regla de
 * producción y conectaría en claro o sin verificar el certificado). Solo se admite lo que mantiene TLS
 * verificado (`sslmode=verify-full`, `sslrootcert`, `sslcert`, `sslkey`) y siempre junto a DATABASE_SSL=true.
 */
function checkDatabaseUrlTls(env: DatabaseEnv, ctx: z.RefinementCtx): void {
  // `superRefine` se ejecuta aunque la URL sea inválida: ese error ya lo ha dado su propio esquema.
  const url = URL.parse(env.DATABASE_URL);
  if (!url) return;
  const rejected = [...url.searchParams]
    .filter(([rawKey, value]) => {
      const key = rawKey.toLowerCase();
      if (URL_TLS_OVERRIDE_PARAMS.has(key)) return true;
      if (key === 'sslmode') return !env.DATABASE_SSL || value !== 'verify-full';
      return URL_TLS_VERIFIED_PARAMS.has(key) && !env.DATABASE_SSL;
    })
    .map(([key]) => key);
  if (rejected.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['DATABASE_URL'],
      message:
        `DATABASE_URL no puede llevar parámetros TLS que contradigan DATABASE_SSL (${rejected.join(', ')}): ` +
        'quítalos y usa DATABASE_SSL (solo se admite sslmode=verify-full con DATABASE_SSL=true)',
    });
  }
}

/** Reglas comunes a la API y al migrador sobre la conexión a la BD. */
export function checkDatabaseEnv(env: DatabaseEnv, ctx: z.RefinementCtx): void {
  checkDatabaseSsl(env, ctx);
  checkDatabaseUrlTls(env, ctx);
}

/** En producción los orígenes se definen siempre de forma explícita, con https:// y sin localhost (salvo escape). */
function checkProductionCorsOrigins(
  origins: string[] | undefined,
  allowLocalhost: boolean,
  ctx: z.RefinementCtx,
): void {
  if (!origins || origins.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: 'En producción CORS_ORIGINS es obligatoria (p. ej. https://rulet.app)',
    });
    return;
  }
  // Los orígenes con formato inválido ya los ha rechazado el esquema del campo.
  const urls = origins.map((origin) => URL.parse(origin)).filter((url) => url !== null);
  const local = urls.filter(isLocalhost).map((url) => url.origin);
  if (local.length > 0 && !allowLocalhost) {
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: `En producción CORS_ORIGINS no admite localhost salvo ALLOW_LOCALHOST_CORS=true: ${local.join(', ')}`,
    });
  }
  const insecure = urls
    .filter((url) => url.protocol === 'http:' && !isLocalhost(url))
    .map((url) => url.origin);
  if (insecure.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: `En producción los orígenes deben ser https:// (salvo localhost): ${insecure.join(', ')}`,
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
    // Sin valor: obligatoria en producción; fuera de ella, el origen local del cliente web.
    CORS_ORIGINS: z
      .string()
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .refine((origins) => origins.every(isValidOrigin), {
        message: 'CORS_ORIGINS debe ser una lista de orígenes (esquema://host[:puerto]) separados por comas',
      })
      .optional(),
    // Escape explícito para producción con orígenes localhost (solo docker compose local). Nunca en un despliegue real.
    ALLOW_LOCALHOST_CORS: booleanFromString.default(false),
    // Sin valor: obligatoria en producción; fuera de ella, `loopback` (proxy de desarrollo y tests e2e).
    TRUST_PROXY: TrustProxySchema.optional(),
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ISSUER: z.string().min(1).default('rulet-api'),
    JWT_AUDIENCE: z.string().min(1).default('rulet-clients'),
    // Sin valor: se decide según NODE_ENV en el `transform` final.
    COOKIE_SECURE: booleanFromString.optional(),
  })
  .superRefine((env, ctx) => {
    checkDatabaseEnv(env, ctx);
    if (env.NODE_ENV !== 'production') return;
    if (DEV_SECRET_MARKERS.test(env.JWT_ACCESS_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message:
          'JWT_ACCESS_SECRET es un valor de ejemplo o de desarrollo (público): genera uno con `openssl rand -base64 48`',
      });
    }
    if (env.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message:
          "En producción TRUST_PROXY es obligatoria: número de proxies delante de la API (p. ej. 1 tras un balanceador), lista de IP/CIDR de los proxies, o 'false' si la API recibe tráfico directo",
      });
    }
    checkProductionCorsOrigins(env.CORS_ORIGINS, env.ALLOW_LOCALHOST_CORS, ctx);
  })
  .transform((env) => ({
    ...env,
    CORS_ORIGINS: env.CORS_ORIGINS ?? DEV_CORS_ORIGINS,
    TRUST_PROXY: env.TRUST_PROXY ?? ['loopback'],
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

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
  const result = DatabaseEnvSchema.superRefine(checkDatabaseEnv).safeParse(raw);
  if (!result.success) throw new Error(formatError(result.error));
  return result.data;
}
