# @rulet/api

API REST en **NestJS 12** (ESM, Node 24) sobre **PostgreSQL** con **Drizzle ORM**. Única puerta a los datos para web
y móvil.

```bash
pnpm dev:api                              # desde la raíz, con recarga (nest start --watch), puerto 3000
pnpm --filter @rulet/api test             # unitarios (Vitest, sin BD)
pnpm --filter @rulet/api test:e2e         # e2e contra PostgreSQL (BD *_test)
```

Antes de arrancar: `cp .env.example .env` y una base de datos accesible en `DATABASE_URL` con las migraciones
aplicadas (`pnpm --filter @rulet/api db:migrate`). Las tres formas de tenerla están en el
[README de la raíz](../../README.md#puesta-en-marcha).

## Scripts

| Script              | Comando                                      | Uso                                                                             |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `dev`               | `nest start --watch`                         | Desarrollo                                                                      |
| `build`             | `nest build -p tsconfig.build.json`          | Compila a `dist/` (incluye `dist/database/migrate.js`)                          |
| `start`             | `node dist/main.js`                          | Arranque compilado                                                              |
| `db:generate`       | `drizzle-kit generate`                       | Nueva migración en `drizzle/` a partir de `src/database/schema` (no se conecta) |
| `db:migrate`        | `drizzle-kit migrate`                        | Aplica las migraciones pendientes a `DATABASE_URL`                              |
| `db:studio`         | `drizzle-kit studio`                         | Explorador de datos sobre `DATABASE_URL`                                        |
| `test`              | `vitest run`                                 | `src/**/*.spec.ts`                                                              |
| `test:e2e`          | `vitest run --config ./vitest.config.e2e.ts` | `test/**/*.e2e-spec.ts`, en serie                                               |
| `test:cov`          | `vitest run --coverage`                      | Cobertura                                                                       |
| `lint`, `typecheck` | —                                            | ESLint (`@rulet/eslint-config/nest`) y `tsc --noEmit`                           |

`drizzle.config.ts` carga `apps/api/.env` si existe; las variables ya definidas en el entorno tienen prioridad.

En producción las migraciones **no** se aplican con drizzle-kit sino con el migrador compilado, como paso previo y
separado del arranque (la API nunca migra al arrancar):

```bash
node dist/database/migrate.js   # solo valida las variables DATABASE_*; toma un pg_advisory_lock
node dist/main.js
```

Más en [Base de datos](../../docs/database.md).

## Estructura

```
src/
├── main.ts              Arranque
├── app.setup.ts         Middlewares de Express en orden, CORS, versionado URI, logger, apagado ordenado (lo usan los e2e)
├── app.module.ts        Composición: config, BD, throttler, módulos, AllExceptionsFilter y guards globales
├── config/              env.ts (esquema Zod + reglas de producción) · AppConfigService · AppConfigModule
├── common/
│   ├── auth/            auth-cookies.ts (nombres, opciones y lectura de cookies de sesión)
│   ├── decorators/      @Public() · @CurrentUser() · @Roles() · @ClientPlatform()
│   ├── guards/          CsrfGuard · JwtAuthGuard · RolesGuard · FeatureGuard (@RequireFeature)
│   ├── pipes/           ZodValidationPipe · RequiredPlatformPipe
│   ├── middleware/      requestIdMiddleware · bodyParserErrorHandler
│   └── filters/         AllExceptionsFilter
├── database/            database.module.ts (token DATABASE) · pool-config.ts · migrate.ts · schema/ (users, sessions)
└── modules/
    ├── auth/            register, login, refresh, logout · JWT de acceso · argon2id · refresh tokens · sesiones
    ├── users/           GET /v1/users/me
    └── health/          GET /health · GET /health/ready
drizzle/                 Migraciones SQL (0000_init, 0001_session_family_expiry) + meta/
test/                    e2e (supertest) · support/ · global-setup.ts (migra la BD *_test) · test-env.ts
```

Orden de la tubería (middlewares → guards → pipes → controller → filtro): ver
[Arquitectura](../../docs/architecture.md#tubería-de-una-petición).

## Endpoints

| Método y ruta            | Acceso                                             | Respuesta                                                            |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /v1/auth/register` | `@Public()`, 3/min por IP                          | `201` `AuthResponse`; `409` si el email existe                       |
| `POST /v1/auth/login`    | `@Public()`, 5/min por IP, 10/15 min por cuenta    | `200` `AuthResponse`; `401` si las credenciales no son válidas       |
| `POST /v1/auth/refresh`  | `@Public()`, 30/min por IP                         | `200` `AuthResponse` con tokens rotados; `401`                       |
| `POST /v1/auth/logout`   | `@Public()` (el access token puede haber caducado) | `204` siempre; revoca la sesión y borra las cookies                  |
| `GET /v1/users/me`       | Autenticada                                        | `200` `User`                                                         |
| `GET /health`            | `@Public()`, `@SkipThrottle()`, sin versión        | Liveness (`status`, `version`, `uptime`, `timestamp`); no toca la BD |
| `GET /health/ready`      | `@Public()`, `@SkipThrottle()`, sin versión        | `200`/`503` `ReadinessResponse` (`checks.database`, timeout 2 s)     |

Los endpoints de auth exigen la cabecera `x-client-platform` (`RequiredPlatformPipe`, `400` si falta) porque de ella
depende el transporte: `mobile` recibe `tokens` en el cuerpo; `web` los recibe en cookies httpOnly y nunca en el
cuerpo. Detalle en [Seguridad](../../docs/security.md#transporte-de-tokens-por-plataforma).

## Reglas

- Nuevos endpoints en `src/modules/<dominio>`, con controller → service → repository; se publican en `/v1/<ruta>`.
  Empieza con `pnpm gen api-module` ([generadores](../../turbo/generators/README.md)).
- Toda ruta exige token salvo `@Public()` (justificado). El propietario sale de `@CurrentUser()`, nunca del cuerpo.
- Valida la entrada con `ZodValidationPipe(<Schema>)` usando contratos de `@rulet/shared`.
- Solo los repositorios inyectan `DATABASE`; todo cambio de esquema va con su migración (`db:generate`).
- Lanza excepciones de Nest (`NotFoundException`…): `AllExceptionsFilter` las convierte en `ApiErrorResponse`.
- Restringe por rol con `@Roles('admin')` y por plataforma con `@RequireFeature('<feature>')`.
- Lee configuración con `AppConfigService`, nunca con `process.env` (lo impide ESLint).

Patrones y prohibiciones por capa: [Manual de desarrollo](../../docs/development-guide.md).

## Variables de entorno

Validadas en `src/config/env.ts`; todas comentadas en [`.env.example`](./.env.example).

| Variable                             | Por defecto                                 | Notas                                                                                                                                       |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | — (obligatoria)                             | `postgres://` o `postgresql://`; sin parámetros TLS salvo `sslmode=verify-full`, `sslrootcert`, `sslcert`, `sslkey` con `DATABASE_SSL=true` |
| `DATABASE_SSL`                       | `false`                                     | TLS verificado hacia la BD; obligatorio en producción                                                                                       |
| `DATABASE_SSL_ALLOW_INSECURE`        | `false`                                     | Escape explícito para producción sin TLS (solo compose local)                                                                               |
| `DATABASE_POOL_MAX`                  | `10`                                        | Conexiones por instancia (1–100)                                                                                                            |
| `JWT_ACCESS_SECRET`                  | — (obligatoria)                             | ≥ 32 caracteres; en producción se rechazan los de ejemplo o desarrollo                                                                      |
| `JWT_ISSUER` / `JWT_AUDIENCE`        | `rulet-api` / `rulet-clients`               | Claims `iss` / `aud` del access token                                                                                                       |
| `CORS_ORIGINS`                       | `http://localhost:3001` fuera de producción | En producción obligatoria, `https://` y sin localhost (salvo `ALLOW_LOCALHOST_CORS=true`)                                                   |
| `TRUST_PROXY`                        | `loopback` fuera de producción              | `false`, nº de proxies (1–10) o lista de IP/CIDR; obligatoria en producción                                                                 |
| `COOKIE_SECURE`                      | `true` si `NODE_ENV=production`             | Cookies `Secure` con prefijos `__Host-` / `__Secure-`                                                                                       |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | `60000` / `100`                             | Límite global por IP                                                                                                                        |
| `PORT`, `APP_VERSION`, `NODE_ENV`    | `3000`, `0.0.0`, `development`              | —                                                                                                                                           |

## Tests

- **Unitarios** (`src/**/*.spec.ts`): no se conectan a ninguna BD; usan `unitTestEnv` de `test/test-env.ts`.
- **e2e** (`test/*.e2e-spec.ts`): levantan la app con `setupApp` (la misma configuración que producción) contra
  PostgreSQL real. `test/global-setup.ts` aplica las migraciones y **se niega** a usar una BD cuyo nombre no termine
  en `_test`. URL por defecto `postgres://rulet:rulet@localhost:5432/rulet_test`; se cambia con `TEST_DATABASE_URL`.

## Limitaciones conocidas

- Rate limiting en memoria de cada proceso: con varias réplicas el límite efectivo se multiplica (falta un
  almacén compartido, p. ej. Redis).
- No hay job de limpieza de `sessions` caducadas o revocadas.
- No hay verificación de email, recuperación ni cambio de contraseña, ni MFA.
- No hay documentación OpenAPI.

Lista completa: [Seguridad §9](../../docs/security.md#9-riesgos-residuales-y-trabajo-pendiente). Despliegue:
[Entornos y despliegue](../../docs/environments.md#api--contenedor) y
[GitHub y despliegue](../../docs/github-and-deployment.md).
