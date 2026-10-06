# @rulet/shared

Código **agnóstico de plataforma** que usan la API, la web y el móvil. No puede importar React, React Native, Expo,
Next ni Nest (lo impide `@rulet/eslint-config/library`). Solo depende de `zod`.

Todo se importa desde la raíz del paquete (`import { UserSchema } from '@rulet/shared'`); lo que no exporta
`src/index.ts` es interno.

| Archivo / carpeta     | Contiene                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/auth.ts`   | `RegisterRequestSchema`, `LoginRequestSchema`, `RefreshRequestSchema`, `LogoutRequestSchema`, `PasswordSchema` (12–128), `AuthTokensSchema`, `AuthResponseSchema` (`{ user, tokens? }`) y sus tipos |
| `contracts/users.ts`  | `UserSchema` (`id`, `email`, `name`, `role`, `createdAt`)                                                                                                                                           |
| `contracts/health.ts` | `HealthResponseSchema` (liveness) y `ReadinessResponseSchema` (`{ status, checks }`)                                                                                                                |
| `contracts/error.ts`  | `ApiErrorResponseSchema`: formato único de error de la API                                                                                                                                          |
| `domain/roles.ts`     | `ROLES = ['user', 'admin']` y `Role` (también alimentan el enum `user_role` de la BD)                                                                                                               |
| `features/index.ts`   | `FEATURES` (`auth`, `profile`, `pushNotifications`, `adminPanel`), `isFeatureAvailable`, `featuresFor`                                                                                              |
| `platform.ts`         | `PLATFORMS`, `Platform` (`web` \| `mobile`), `CLIENT_PLATFORM_HEADER` (`x-client-platform`), `isPlatform`                                                                                           |
| `auth-transport.ts`   | `AUTH_COOKIES` (nombres con y sin prefijo `__Host-`/`__Secure-`), `REFRESH_COOKIE_PATH` (`/v1/auth`), `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_SECONDS` (30 días)                       |

## Reglas de los contratos

- Los esquemas de **petición** son `z.strictObject`: los campos desconocidos se rechazan (evita mass assignment).
- El email se normaliza en el propio esquema (`trim` + minúsculas): la API lo guarda ya normalizado.
- Cambiar un contrato es un cambio de API: TypeScript marcará todos los usos en API, web y móvil, que se adaptan en
  el mismo PR. Un rol nuevo en `ROLES` exige además una migración (`pnpm --filter @rulet/api db:generate`).
- Un contrato nuevo se crea con `pnpm gen contract` ([generadores](../../turbo/generators/README.md)).

## Build

Web y móvil consumen el TypeScript fuente (condición `default` de `exports`). Node (la API y sus tests) usa el build
CommonJS de `dist/` mediante la condición `node`, así que tras cambiar este paquete hay que compilarlo:
`pnpm --filter @rulet/shared build` (o `pnpm turbo run <tarea>`, que lo hace por `dependsOn: ["^build"]`).

| Script      | Comando                      |
| ----------- | ---------------------------- |
| `build`     | `tsc -p tsconfig.build.json` |
| `typecheck` | `tsc --noEmit`               |
| `lint`      | `eslint . --max-warnings=0`  |

No tiene tests propios: los contratos se ejercitan en los tests de la API (`apps/api`) y de `@rulet/api-client`.
