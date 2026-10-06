# Manual de desarrollo

Cómo se programa en Rulet: **en qué orden**, **qué va en cada capa** y **qué se comprueba antes de fusionar**. Es
obligatorio para cualquier cambio de funcionalidad, lo haga una persona o un agente.

- Visión global y reglas de dependencia: [Arquitectura](./architecture.md).
- El mismo proceso aplicado a un ejemplo completo: [Añadir una funcionalidad](./adding-a-feature.md).
- Nombres, commits y ramas: [Convenciones](./conventions.md).
- Modelo de seguridad: [Seguridad](./security.md) y [`SECURITY.md`](../SECURITY.md).
- Variables de entorno y despliegue: [Entornos y despliegue](./environments.md).
- Generadores de código: [`turbo/generators/README.md`](../turbo/generators/README.md).

## Índice

0. [Preparar el entorno](#0-preparar-el-entorno)
1. [Orden obligatorio de trabajo](#1-orden-obligatorio-de-trabajo)
2. [Responsabilidades y prohibiciones por capa](#2-responsabilidades-y-prohibiciones-por-capa)
3. [Estructura de carpetas canónica](#3-estructura-de-carpetas-canónica)
4. [Patrones obligatorios](#4-patrones-obligatorios)
5. [Tests](#5-tests)
6. [Definition of Done y revisión de código](#6-definition-of-done-y-revisión-de-código)
7. [Flujo git](#7-flujo-git)
8. [Limitaciones conocidas](#8-limitaciones-conocidas)

## 0. Preparar el entorno

| Requisito  | Cómo                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Node 24    | `.nvmrc` contiene `24` → `nvm use`. `package.json` exige `"engines": { "node": ">=24" }`.           |
| pnpm 10    | `corepack enable pnpm` (versión fijada en `packageManager`: `pnpm@10.28.0`).                        |
| Hooks git  | `pnpm install` ejecuta `prepare` (`husky \|\| true`) e instala `pre-commit` y `commit-msg`.         |
| PostgreSQL | Dev Container (recomendado) o un Postgres propio con las bases `rulet` (desarrollo) y `rulet_test`. |

**Dev Container / Codespaces** (`.devcontainer/`): levanta PostgreSQL 17 con las bases `rulet` y `rulet_test`
(usuario `rulet`, contraseña `rulet`), y `post-create.sh` instala dependencias, copia los `.env.example` que
falten y aplica las migraciones a `rulet`.

**Sin Dev Container**:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @rulet/api db:migrate      # aplica apps/api/drizzle/ a DATABASE_URL (apps/api/.env)
pnpm dev                                  # API :3000, web :3001, Expo
```

Los valores por defecto esperan `postgres://rulet:rulet@localhost:5432/rulet` (`apps/api/.env.example`) y
`postgres://rulet:rulet@localhost:5432/rulet_test` para los e2e (`apps/api/test/test-env.ts`). El servicio `db`
del `docker-compose.yml` de la raíz usa esas mismas credenciales y crea las dos bases (`docker compose up -d db`).
Los pasos para usarlo, o para un PostgreSQL nativo, están en [Base de datos § 12](./database.md#12-postgresql-en-local).

## 1. Orden obligatorio de trabajo

Todo cambio de funcionalidad sigue estos pasos **en este orden**. Cada paso se apoya en el anterior: el contrato
tipa la API, la API define lo que consume el cliente y el cliente lo que muestra la UI. Si un paso no aplica (p. ej.
no hay tabla nueva), se salta, pero no se reordena.

| #   | Paso                                 | Dónde                                                             | Atajo                                                              |
| --- | ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Decidir plataformas y registrar      | `packages/shared/src/features/index.ts`                           | `pnpm gen feature …` (pasos 1–6 y 9)                               |
| 2   | Contrato Zod                         | `packages/shared/src/contracts/<dominio>.ts`                      | `pnpm gen contract --args <dominio> <entidad>`                     |
| 3   | Esquema Drizzle + migración          | `apps/api/src/database/schema/<dominio>.ts`, `apps/api/drizzle/`  | `pnpm gen api-module …` + `db:generate`                            |
| 4   | Repository                           | `apps/api/src/modules/<dominio>/<dominio>.repository.ts`          | `pnpm gen api-module --args <dominio> <entidad>`                   |
| 5   | Service + tests unitarios            | `<dominio>.service.ts`, `<dominio>.service.spec.ts`               | `pnpm gen api-module …`                                            |
| 6   | Controller fino + guards/decoradores | `<dominio>.controller.ts`, `<dominio>.module.ts`, `app.module.ts` | `pnpm gen api-module …`                                            |
| 7   | Tests e2e                            | `apps/api/test/<dominio>.e2e-spec.ts`                             | — (a mano)                                                         |
| 8   | Acceso desde el cliente              | `api.request(...)` o `packages/api-client/src/client.ts`          | — (`client-feature` ya usa `api.request`)                          |
| 9   | UI en web y/o móvil                  | `apps/<plataforma>/src/features/<dominio>/` + `src/app`           | `pnpm gen client-feature --args <web\|mobile> <dominio> <entidad>` |
| 10  | Documentación y ADR                  | `docs/`, `docs/adr/`, READMEs                                     | —                                                                  |
| 11  | Verificación y PR                    | —                                                                 | `pnpm check`, `pnpm test:e2e`                                      |

```mermaid
flowchart LR
  F["1 · FEATURES"] --> C["2 · contrato"] --> D["3 · tabla + migración"] --> R["4 · repository"]
  R --> S["5 · service + unit"] --> K["6 · controller"] --> E["7 · e2e"] --> AC["8 · cliente"]
  AC --> UI["9 · UI web/móvil"] --> DOC["10 · docs/ADR"] --> PR["11 · check + PR"]
  G1(["pnpm gen feature"]) -.-> F & C & D & R & S & K & UI
  G2(["pnpm gen contract"]) -.-> C
  G3(["pnpm gen api-module"]) -.-> D & R & S & K
  G4(["pnpm gen client-feature"]) -.-> UI
```

Los generadores crean el esqueleto con la arquitectura y las defensas de serie (ver
[`turbo/generators/README.md`](../turbo/generators/README.md)). **No sustituyen los pasos**: después de generar,
recorre cada paso, adapta el campo de ejemplo `name` a tu dominio y revisa lo generado. Nombres: _dominio_ en
kebab-case y plural (`order-items`), _entidad_ en kebab-case y singular (`order-item`). `turbo gen` sale con código
0 aunque falle: comprueba que la salida termina en `>>> Success!`.

### Paso 1 — Decidir plataformas y registrar en `FEATURES`

Decide en qué plataformas existe la funcionalidad (`web`, `mobile` o ambas) y añádela a `FEATURES` en
`packages/shared/src/features/index.ts` con clave en camelCase (`orderItems: ['web', 'mobile']`). Es lo que leen
`useFeature()` en los clientes y `@RequireFeature()` en la API.

- Atajo: `pnpm gen feature --args <dominio> <entidad> <web|mobile|web,mobile>` registra la clave (camelCase del
  dominio), crea el contrato, el módulo de API con `@RequireFeature('<clave>')` y la UI de cada plataforma.
- Si la decisión es estructural (una funcionalidad que cambia reglas de dependencia, una plataforma nueva…),
  escribe antes el ADR (paso 10).

### Paso 2 — Contrato Zod en `@rulet/shared`

`pnpm gen contract --args <dominio> <entidad>` crea `packages/shared/src/contracts/<dominio>.ts` con
`<Entidad>Schema`, `Create<Entidad>RequestSchema` (`z.strictObject`), `<Entidad>ListSchema` y sus tipos, y lo
exporta en `contracts/index.ts`.

- Sustituye el campo de ejemplo `name` por los campos reales **antes** de generar el módulo de API.
- Peticiones con `z.strictObject` (rechaza campos desconocidos: evita _mass assignment_), con límites
  (`.max()`, `.trim()`, `.min()`) en cada cadena y número.
- La respuesta pública nunca incluye el propietario (`userId`) ni datos internos.
- La API y sus tests cargan `@rulet/shared` compilado (`exports.node` → `dist/index.js`): tras cambiar un contrato,
  `pnpm --filter @rulet/shared build`.
- **Compatibilidad**: la app móvil publicada sigue usando el contrato con el que se compiló hasta que el usuario
  actualiza. En un endpoint existente solo se añaden campos opcionales; un cambio incompatible es una ruta nueva o
  una versión nueva de URI (la API usa `enableVersioning` con `defaultVersion: '1'`).

### Paso 3 — Esquema Drizzle y migración

La tabla vive en `apps/api/src/database/schema/<dominio>.ts` y se exporta en `schema/index.ts` (lo hace
`pnpm gen api-module`). Nombres en BD en `snake_case`, en TS en `camelCase`, siempre explícitos
(`uuid('user_id')`).

```bash
pnpm --filter @rulet/api db:generate --name <descripcion_corta>   # drizzle-kit generate → apps/api/drizzle/NNNN_<nombre>.sql
pnpm --filter @rulet/api db:migrate                               # aplica a DATABASE_URL (BD de desarrollo)
```

- `db:generate` no se conecta a la BD; compara `src/database/schema` con `drizzle/meta`.
- **Revisa el SQL generado** y súbelo en el mismo PR (SQL + `drizzle/meta/*`). Si añades una columna `NOT NULL` a
  una tabla con datos, edítalo en tres pasos como `drizzle/0001_session_family_expiry.sql`: columna nullable,
  relleno y `SET NOT NULL`.
- Una migración ya fusionada **no se edita**: se escribe otra.
- En despliegue las migraciones se aplican antes de arrancar la API, con `node dist/database/migrate.js` (servicio
  `migrate` en `docker-compose.yml`); la API nunca migra al arrancar. La versión anterior de la API sigue sirviendo
  mientras tanto: la migración debe ser compatible con ella.
- Cada tabla de un usuario lleva `user_id uuid not null` con FK a `users` `on delete cascade` e índice que empiece
  por `user_id` (la plantilla crea `(user_id, created_at)`).
- Un valor que debe ser único se garantiza con una restricción `unique` en BD, no con un `SELECT` previo.

### Paso 4 — Repository

`<dominio>.repository.ts` es **la única pieza que conoce Drizzle**. Inyecta la BD con
`@Inject(DATABASE) private readonly db: Database` (`apps/api/src/database/database.module.ts`).

- Todo método recibe el propietario y filtra por él (`findByIdForOwner(userId, id)`,
  `and(eq(t.id, id), eq(t.userId, userId))`).
- Todo listado lleva `.limit()` (la plantilla usa `LIST_LIMIT = 100`).
- Devuelve filas (`<Entidad>Row`), nunca respuestas HTTP. No lanza excepciones HTTP.

### Paso 5 — Service y sus tests unitarios

`<dominio>.service.ts` contiene la lógica de negocio: decide, compone repositorios, lanza excepciones de Nest
(`NotFoundException`, `ConflictException`…) y proyecta filas a respuestas con una función de lista blanca
(`toPublic<Entidad>(row)`), que es la única forma de construir lo que sale por HTTP.

Los tests van en `<dominio>.service.spec.ts` con el repositorio simulado (`vi.fn`); ver
[§5](#5-tests). Comando: `pnpm turbo run test --filter=@rulet/api`.

### Paso 6 — Controller fino, guards y decoradores

`<dominio>.controller.ts` solo traduce HTTP ↔ service:

```ts
@Controller('order-items') // → /v1/order-items
export class OrderItemsController {
  constructor(private readonly service: OrderItemsService) {}

  @Post()
  create(
    @CurrentUser() current: AuthUser,
    @Body(new ZodValidationPipe(CreateOrderItemRequestSchema)) body: CreateOrderItemRequest,
  ): Promise<OrderItem> {
    return this.service.create(current.id, body);
  }
}
```

- Sin `@Public()`: el `JwtAuthGuard` global exige access token. `@Public()` solo con justificación en el PR.
- `@Roles('admin')` (`common/decorators/roles.decorator.ts`) para restringir por rol (403).
- `@RequireFeature('<clave>')` (`common/guards/feature.guard.ts`) si la funcionalidad no existe en todas las
  plataformas.
- `@Throttle({ default: { limit, ttl } })` (`@nestjs/throttler`) en rutas caras o sensibles, como en
  `auth.controller.ts`.
- `@HttpCode(HttpStatus.OK)` en un `POST` que no crea; `@HttpCode(HttpStatus.NO_CONTENT)` en un `DELETE`.
- El módulo se registra en `apps/api/src/app.module.ts` tras la línea
  `// Módulos de dominio: uno por carpeta en src/modules.` (el generador lo hace; no cambies esa línea).

### Paso 7 — Tests e2e

`apps/api/test/<dominio>.e2e-spec.ts` contra PostgreSQL real (`rulet_test`). Cubre como mínimo: 401 sin sesión,
camino feliz con validación del contrato, 400 por campo extra y por id no UUID, y **404 al acceder a un recurso de
otro usuario**. Ver [§5.3](#53-cómo-escribir-un-test-e2e). No hay generador: el e2e depende de la migración.

### Paso 8 — Acceso desde el cliente (`@rulet/api-client`)

Los clientes llaman a la API solo a través de la instancia `api` de cada app (`apps/web/src/lib/api.ts`,
`apps/mobile/src/lib/api.ts`), creada con `createApiClient`.

- Por defecto: `api.request(<Schema>, '/<ruta>', { method, body, signal })`. La ruta es relativa a `/v1`, `body` se
  serializa a JSON (no uses `JSON.stringify`), la respuesta se valida con el esquema y la sesión se renueva sola
  ante un 401. Es lo que genera `client-feature`.
- Un método tipado en `ApiClient` (`packages/api-client/src/client.ts`, como `users.me()`) solo cuando el endpoint
  necesita lógica de transporte propia (como `auth.*`). Lleva tests en `packages/api-client/src/client.test.ts`
  y se documenta en `packages/api-client/README.md`.

### Paso 9 — UI en `features/<feature>`

`pnpm gen client-feature --args <web|mobile> <dominio> <entidad>` crea `apps/<plataforma>/src/features/<dominio>/`
con `index.ts`, el hook, un componente de lista y los mensajes de error (ver [§3](#3-estructura-de-carpetas-canónica)).
Las pantallas (`src/app`) solo importan del `index.ts` de la feature.

- Web: rutas autenticadas envueltas en `<RequireAuth>` (`@/features/auth`); es UX, la protección real es la API.
- Móvil: pantallas con sesión dentro de `src/app/(app)/` (grupo protegido con `Stack.Protected`).
- `useFeature('<clave>')` (`src/hooks/use-feature.ts`) para mostrar u ocultar UI según `FEATURES`.

### Paso 10 — Documentación y ADR

- Variable de entorno nueva → esquema `env`, `.env.example` y tabla de [environments.md](./environments.md) (ver
  [§4.7](#47-configuración)).
- Cambio estructural o caro de revertir (BD, auth, librería estructural, reglas de dependencia) → ADR en
  `docs/adr/` a partir de [`template.md`](./adr/template.md), y fila en [`docs/adr/README.md`](./adr/README.md).
- Si cambias la forma de un módulo o de una feature, actualiza también las plantillas de `turbo/generators/templates`:
  son la definición ejecutable de la arquitectura.
- README del paquete afectado si cambia su API pública.

### Paso 11 — Verificación y PR

```bash
pnpm check        # turbo run lint typecheck test + prettier --check + turbo boundaries
pnpm test:e2e     # e2e de la API contra rulet_test (no está dentro de pnpm check)
pnpm build        # CI también compila todo
```

Después, PR según [§7](#7-flujo-git).

## 2. Responsabilidades y prohibiciones por capa

| Capa                          | Dónde                                                                  | Hace                                                                                                           | **No puede**                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Contrato                      | `packages/shared/src/contracts`                                        | Esquemas Zod de peticiones y respuestas y sus tipos inferidos.                                                 | Importar de `apps/*`, de React/RN/Expo/Next/`@nestjs/*`; hacer I/O; exponer `userId`, hashes o columnas internas.                  |
| Controller                    | `apps/api/src/modules/<d>/<d>.controller.ts`                           | Ruta, código HTTP, decoradores, validación de entrada con pipes, identidad con `@CurrentUser()`.               | Acceder a la BD o inyectar `DATABASE`/repositorios; contener lógica de negocio; leer el propietario del cuerpo o la URL.           |
| Service                       | `<d>.service.ts`                                                       | Lógica de negocio, excepciones de Nest, proyección pública con lista blanca.                                   | Importar Drizzle o `DATABASE`; conocer `Request`/`Response` de Express; devolver filas tal cual.                                   |
| Repository                    | `<d>.repository.ts`                                                    | Consultas Drizzle filtradas por propietario, con `limit`, y transacciones.                                     | Lanzar `HttpException`; consultar sin filtrar por propietario un recurso de usuario; exportarse a otros módulos.                   |
| Guards                        | `apps/api/src/common/guards`                                           | Decisiones transversales por petición (rate limit, CSRF, JWT, rol, plataforma).                                | Lógica de un dominio concreto; abrir por defecto (sin metadatos o sin usuario se deniega).                                         |
| Pipes                         | `apps/api/src/common/pipes`                                            | Validar y transformar entrada (`ZodValidationPipe`, `RequiredPlatformPipe`, `ParseUUIDPipe` de Nest).          | Acceder a la BD; aplicar reglas de negocio.                                                                                        |
| Decoradores                   | `apps/api/src/common/decorators`                                       | Metadatos (`@Public`, `@Roles`) y parámetros (`@CurrentUser`, `@ClientPlatform`).                              | Efectos secundarios.                                                                                                               |
| Módulos `env`                 | API `src/config/env.ts`; web y móvil `src/lib/env.ts`                  | Leer `process.env` una vez y validarlo con Zod.                                                                | — Son los **únicos** que leen `process.env` (más `database/migrate.ts`, `*.config.*` y tests). ESLint lo impide en el resto.       |
| Cliente (`@rulet/api-client`) | `packages/api-client/src`                                              | Transporte por plataforma, renovación de sesión, timeout, validación de respuestas.                            | Depender de React/RN/Next; devolver tokens al llamante; seguir redirecciones.                                                      |
| Instancia `api`               | `apps/<plataforma>/src/lib/api.ts`                                     | Crear el cliente con el `env` validado y repartir `onSessionExpired`.                                          | Usarse desde Server Components o `proxy.ts` en web (allí no viajan las cookies del usuario).                                       |
| Hooks de feature              | `features/<f>/hooks/use-*.ts`                                          | Estado de la feature y llamadas `api.*`; cancelación con `AbortController`; traducir errores a mensajes fijos. | Llamar a `fetch` directamente; guardar tokens; mostrar el texto del servidor.                                                      |
| Componentes de feature        | `features/<f>/components`                                              | Pintar el estado que da el hook y emitir eventos.                                                              | Llamar a `fetch` o importar `lib/api`; usar `dangerouslySetInnerHTML`; en web, `style={{…}}` (lo bloquea la CSP).                  |
| Componentes compartidos       | `src/components`                                                       | UI reutilizable por props.                                                                                     | Importar de `features/` o de `lib/api`; lógica de negocio.                                                                         |
| Providers                     | web `features/auth/components/AuthProvider.tsx`; móvil `src/providers` | Estado global (sesión). Junto con los hooks, únicos que importan `lib/api`.                                    | Lógica de una feature concreta.                                                                                                    |
| Rutas                         | `src/app` (Next App Router / expo-router)                              | Componer lo que exporta `features/<f>/index.ts`; metadatos de página.                                          | Lógica, llamadas a la API, importar rutas internas de una feature; en móvil, contener tests (expo-router los trataría como rutas). |

Reglas de dependencia que hace cumplir la herramienta (ver [Arquitectura](./architecture.md#reglas-de-dependencia)):
`turbo boundaries` (tags `app`/`lib`) y ESLint (`no-restricted-imports`, `no-restricted-properties` para
`process.env`, `no-restricted-syntax` para `dangerouslySetInnerHTML`, `no-eval` y afines). La separación
controller → service → repository **no** la comprueba ninguna herramienta: es responsabilidad de la revisión.

## 3. Estructura de carpetas canónica

### Módulo de API

```
apps/api/src/
├── database/schema/
│   ├── <dominio>.ts                 tabla Drizzle + tipos <Entidad>Row / New<Entidad>Row
│   └── index.ts                     export * from './<dominio>.js';
└── modules/<dominio>/
    ├── <dominio>.module.ts          controllers + providers; exporta el service si otro módulo lo usa (nunca el repository)
    ├── <dominio>.controller.ts      clase <Dominio>Controller
    ├── <dominio>.service.ts         clase <Dominio>Service + toPublic<Entidad>()
    ├── <dominio>.repository.ts      clase <Dominio>Repository
    └── <dominio>.service.spec.ts    tests unitarios (Vitest)
apps/api/drizzle/NNNN_<nombre>.sql   migración generada + drizzle/meta/*
apps/api/test/<dominio>.e2e-spec.ts  tests e2e
```

Piezas auxiliares de un módulo siguen `<nombre>.<tipo>.ts` (`access-token.service.ts`, `sessions.repository.ts`)
o `kebab-case.ts` si no son piezas Nest (`refresh-token.ts`). En la API los imports relativos llevan **`.js`**
(`import { X } from './x.service.js';`): es ESM con `module: nodenext`.

### Feature web (`apps/web/src/features/<dominio>/`)

```
index.ts                              API pública (lo único que importan src/app y otras features)
hooks/use-<dominio>.ts                'use client'; estado + api.request
lib/<dominio>-error-message.ts        ApiError → mensaje fijo
components/<Entidad>List.tsx          'use client'
components/<Entidad>List.module.css   CSS Modules con las variables de styles/globals.css
```

Imports con el alias `@/` (`@/lib/api`, `@/components/Button`). Pantalla: `src/app/<ruta>/page.tsx`.

### Feature móvil (`apps/mobile/src/features/<dominio>/`)

```
index.ts                              API pública
hooks/use-<dominio>.ts                estado + api.request
errors.ts                             ApiError → mensaje fijo
components/<Entidad>List.tsx          StyleSheet con valores de src/theme
validation.ts (si hay formularios)    lógica pura, con su validation.test.ts
```

Imports relativos (`../../../lib/api`). Pantalla con sesión: `src/app/(app)/<ruta>.tsx`.

### Nombres

| Qué                 | Convención                                           | Ejemplo                                |
| ------------------- | ---------------------------------------------------- | -------------------------------------- |
| Dominio             | kebab-case, plural                                   | `order-items` → `/v1/order-items`      |
| Entidad             | kebab-case, singular                                 | `order-item` → `OrderItemSchema`       |
| Tabla / columnas    | snake_case                                           | `order_items`, `user_id`               |
| Clave en `FEATURES` | camelCase del dominio                                | `orderItems`                           |
| Archivos Nest       | `<dominio>.<tipo>.ts`                                | `order-items.controller.ts`            |
| Componentes React   | `PascalCase.tsx`                                     | `OrderItemList.tsx`                    |
| Hooks               | `use-<algo>.ts`, función `useAlgo`                   | `use-order-items.ts` → `useOrderItems` |
| Tests               | API `*.spec.ts` / `*.e2e-spec.ts`; resto `*.test.ts` | `order-items.service.spec.ts`          |

El resto, en [Convenciones](./conventions.md#nombres).

## 4. Patrones obligatorios

### 4.1 Validación de entrada

- **Toda** entrada externa (cuerpo, query, params) se valida antes de usarse: `ZodValidationPipe(<Schema>)` con el
  esquema del contrato (`@Body(...)`, `@Query(...)`), `ParseUUIDPipe` para ids (`@Param('id', new ParseUUIDPipe())`).
- El pipe responde `400` con `message: 'Datos inválidos'` y `details` (`z.flattenError`), que no repite los valores
  enviados.
- Los clientes validan los formularios con los mismos esquemas antes de enviar (p. ej.
  `apps/mobile/src/features/auth/validation.ts`, `apps/web/src/features/auth/lib/form-validation.ts`); eso es UX, la
  validación que cuenta es la de la API.
- El cuerpo está limitado a `100kb` (`app.setup.ts`); un cuerpo mayor da `413` con el formato común de error.

### 4.2 Errores

**API.** Lanza excepciones de Nest (`NotFoundException`, `ConflictException`, `ForbiddenException`,
`UnauthorizedException`, `BadRequestException`). `AllExceptionsFilter`
(`apps/api/src/common/filters/all-exceptions.filter.ts`) convierte cualquier excepción en `ApiErrorResponse`
(`packages/shared/src/contracts/error.ts`):

```json
{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Recurso no encontrado",
  "path": "/v1/…",
  "requestId": "…",
  "timestamp": "…"
}
```

- Un error que no es `HttpException` responde `500` con `'Error interno del servidor'` y se registra depurado
  (sin parámetros SQL). Nunca devuelvas mensajes internos ni trazas al cliente.
- Mensajes en español, genéricos cuando el detalle revelaría algo (`'Credenciales inválidas'`,
  `'No se ha podido completar el registro'`).

**Clientes.** Todo fallo es un `ApiError` (`@rulet/api-client`) con `status`, `body` (`ApiErrorResponse | null`)
y `code` (`http`, `network`, `timeout`, `aborted`, `invalid_response`, `no_session`); `isNetworkError` e
`isUnauthorized` ayudan a decidir. Cada feature traduce el error a **mensajes fijos** (`errors.ts` en móvil,
`lib/<dominio>-error-message.ts` en web): nunca se muestra `error.message` ni `body.message`.

### 4.3 Autenticación y autorización (seguro por defecto)

Decisión en [ADR 0009](./adr/0009-seguro-por-defecto.md); detalle en
[Seguridad › Autorización segura por defecto](./security.md#autorización-segura-por-defecto).

- Guards globales, en este orden (`app.module.ts`): `ThrottlerGuard` → `CsrfGuard` → `JwtAuthGuard` →
  `RolesGuard` → `FeatureGuard`. Toda ruta exige access token salvo `@Public()`.
- **Propietario (anti-IDOR)**: la identidad sale **solo** de `@CurrentUser()` (`{ id, role }` del token), nunca del
  cuerpo, la query ni la URL. El repositorio filtra **todas** las consultas, también `UPDATE` y `DELETE`, por
  `user_id`. Un recurso ajeno responde `404`, igual que uno inexistente.
- **Mass assignment**: peticiones con `z.strictObject`; el service construye el objeto que se inserta campo a
  campo (`{ userId: ownerId, name: input.name }`), nunca con `...body`.
- **Proyección**: lo que sale por HTTP se construye con `toPublic<Entidad>()` (lista blanca); nunca `userId`,
  `passwordHash` ni columnas internas.
- **Roles**: `@Roles('admin')`. Sin usuario o sin rol, 403.
- `x-client-platform` y `@RequireFeature` son coherencia de producto, **no seguridad**: cualquiera puede enviar la
  cabecera.
- Web: CSRF lo cubren `CsrfGuard` (Origin en `CORS_ORIGINS` en métodos no seguros con cookies de auth), `SameSite`
  y la cabecera `x-client-platform`. Las rutas `GET` no cambian estado.

### 4.4 Listados, límites y paginación

- Todo listado tiene un tope en el repositorio (`.limit(LIST_LIMIT)`, 100 en la plantilla) y orden determinista
  (`orderBy(desc(t.createdAt))`).
- Las cadenas del contrato llevan `.max()`; las contraseñas tienen tope (128) para acotar el coste de argon2.
- Rate limiting global por IP (`THROTTLE_TTL_MS`, `THROTTLE_LIMIT`) y `@Throttle` por ruta donde haga falta.
- **No existe paginación** (ni por cursor ni por página) en ningún endpoint ni en los generadores. Si un listado
  puede superar el tope, hay que diseñarla: parámetros en la query validados con `ZodValidationPipe`, respuesta con
  su contrato y, si se adopta como patrón común, ADR y plantilla del generador.

### 4.5 Transacciones y concurrencia

- Las transacciones se abren dentro de un método del repositorio: `this.db.transaction(async (tx) => { … })`
  (ver `SessionsRepository.rotate` y `revokeFamily`). El service no ve `tx`.
- La corrección ante peticiones simultáneas se apoya en la BD, no en lecturas previas: restricciones `unique` con
  `onConflictDoNothing()` (`UsersRepository.create`), `UPDATE` condicionales (`where … isNull(revokedAt)`) y
  bloqueos consultivos cuando hace falta (`pg_advisory_xact_lock`).
- No hay un patrón para transacciones que crucen módulos. Si lo necesitas, propónlo con un ADR.

### 4.6 Logs

- `private readonly logger = new Logger(<Clase>.name)` de `@nestjs/common`. En producción salen en JSON; en test
  solo `warn`, `error` y `fatal`.
- **Nunca** se registran contraseñas, tokens, cookies, la cabecera `Authorization`, cuerpos de petición ni
  parámetros SQL. Para errores, solo `name`/`message` (ver `describeError` en `all-exceptions.filter.ts`).
- Cada respuesta y cada error llevan `x-request-id`; inclúyelo al registrar algo asociado a una petición.
- `console.log` está prohibido por ESLint (`no-console` permite solo `warn` y `error`); en la API usa `Logger`.

### 4.7 Configuración

| App   | Esquema                                                       | Lectura en el código                           |
| ----- | ------------------------------------------------------------- | ---------------------------------------------- |
| API   | `apps/api/src/config/env.ts` (`EnvSchema`, `validateEnv`)     | `AppConfigService.get('<VARIABLE>')` inyectado |
| Web   | `apps/web/src/lib/env.ts`                                     | `env.NEXT_PUBLIC_API_URL`                      |
| Móvil | `apps/mobile/src/lib/env.ts` (lógica pura en `env-config.ts`) | `env.apiUrl`, `env.allowInsecureHttp`          |

- `process.env` solo se lee en esos módulos (y en `apps/api/src/database/migrate.ts`, los `*.config.*` y los
  tests). Si la configuración es inválida, la API no arranca, `next build` falla (`next.config.ts` importa
  `src/lib/env.ts`) y la app móvil falla al cargar `env.ts`.
- Booleanos con el parser estricto de `env.ts` (`'true' | 'false' | '1' | '0'`), nunca `z.coerce.boolean()`.
- Variable nueva: esquema, `.env.example` de la app, tabla de [environments.md](./environments.md) y, si afecta al
  build, `env` en `turbo.json`.
- `NEXT_PUBLIC_*` y `EXPO_PUBLIC_*` acaban en el bundle: son públicas. Nunca un secreto en ellas.

### 4.8 Seguridad en los clientes

- Web: la sesión vive en cookies httpOnly de la API; los tokens nunca llegan a JavaScript, `localStorage` ni
  `sessionStorage`. Redirecciones internas (`?next=`) siempre por `safeRedirectPath` (`src/lib/safe-redirect.ts`).
  CSP con nonce en `src/proxy.ts`: nada de `style={{…}}` ni scripts en línea.
- Móvil: tokens solo en `expo-secure-store` (`src/lib/secure-token-store.ts`); nunca `AsyncStorage`.
- En ambas: contenido siempre como texto (`dangerouslySetInnerHTML` prohibido por ESLint).

Detalle completo en [Seguridad](./security.md).

## 5. Tests

### 5.1 Qué va en cada tipo

| Tipo         | Qué cubre                                                                                                  | Dónde / patrón                                                   | Contra qué                                   | Comando                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Unitario API | Lógica del service, guards, pipes, filtros, `env`. Proyección pública y propietario pasado al repositorio. | `apps/api/src/**/*.spec.ts`                                      | Repositorio simulado; sin BD (`unitTestEnv`) | `pnpm turbo run test --filter=@rulet/api`      |
| e2e API      | HTTP real: guards, validación, códigos, cookies/CORS, aislamiento entre usuarios, SQL y migraciones.       | `apps/api/test/**/*.e2e-spec.ts`                                 | PostgreSQL real, BD que termina en `_test`   | `pnpm test:e2e`                                |
| Cliente      | Transporte web/móvil, renovación de sesión, errores, validación de respuestas.                             | `packages/api-client/src/*.test.ts`                              | `fetch` simulado                             | `pnpm --filter @rulet/api-client test`         |
| Web          | Lógica pura (`safe-redirect`, CSP, `proxy`).                                                               | `apps/web/src/**/*.test.ts`                                      | Node                                         | `pnpm --filter @rulet/web test`                |
| Móvil        | Lógica pura (validación, errores, `env-config`, primera ejecución, `app.config.ts`).                       | `apps/mobile/src/**/*.test.ts`, `*.test.ts` (nunca en `src/app`) | Node                                         | `pnpm --filter @rulet/mobile test`             |
| Generadores  | Ediciones de archivos y nombres.                                                                           | `turbo/generators/lib/*.test.ts`                                 | Node                                         | `pnpm exec vitest run --root turbo/generators` |

Todo con **Vitest 4** (`globals: true` en la API: `describe`/`it`/`vi` sin importar). Regla práctica: si la
comprobación depende de la BD, de un guard global o de cabeceras HTTP, es e2e; si es una decisión del service, es
unitaria. Toda corrección de un bug llega con el test que lo reproduce.

Notas:

- La API carga `@rulet/shared` desde `dist`: `pnpm --filter @rulet/api test` a secas falla si el contrato nuevo no
  está compilado. `pnpm turbo run test --filter=@rulet/api` (o `pnpm test`) compila antes (`dependsOn: ["^build"]`).
- e2e: `test/global-setup.ts` aplica las migraciones y **se niega** a correr si el nombre de la BD no termina en
  `_test`. La URL sale de `TEST_DATABASE_URL` o, si no existe, `postgres://rulet:rulet@localhost:5432/rulet_test`.
  Los ficheros se ejecutan en serie (`fileParallelism: false`). En CI hay un servicio `postgres:17-alpine`.
- `resetDatabase()` (`test/support/app.ts`) hace `TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE`: las
  tablas con FK a `users` se vacían por el `CASCADE`. Una tabla sin FK a `users` hay que añadirla a esa sentencia.

### 5.2 Cómo escribir un test unitario

El generador crea `<dominio>.service.spec.ts` con este patrón: módulo de test de Nest con el repositorio
sustituido por `vi.fn` tipados.

```ts
async function setup() {
  const repository = { findByIdForOwner: vi.fn<OrderItemsRepository['findByIdForOwner']>() };
  const moduleRef = await Test.createTestingModule({
    providers: [OrderItemsService, { provide: OrderItemsRepository, useValue: repository }],
  }).compile();
  return { service: moduleRef.get(OrderItemsService), repository };
}

it('responde 404 si el recurso no existe o es de otro usuario', async () => {
  const { service, repository } = await setup();
  repository.findByIdForOwner.mockResolvedValue(undefined);
  await expect(service.get(OWNER_ID, ITEM_ID)).rejects.toBeInstanceOf(NotFoundException);
  expect(repository.findByIdForOwner).toHaveBeenCalledWith(OWNER_ID, ITEM_ID);
});
```

Comprueba siempre: que el service pasa el propietario al repositorio, que la salida cumple el contrato
(`<Entidad>Schema.safeParse(item).success`) y que no incluye `userId`.

### 5.3 Cómo escribir un test e2e

Usa `test/support/app.ts`: `createTestApp()` levanta el `AppModule` real con el mismo `setupApp` que producción;
`createClient(app, { platform, origin })` simula una IP distinta por cliente (para no compartir rate limit) y
`uniqueCredentials()` da un email nuevo.

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthResponseSchema, OrderItemSchema } from '@rulet/shared';
import { createClient, createTestApp, resetDatabase, uniqueCredentials } from './support/app.js';

async function signUp(app: NestExpressApplication) {
  const client = createClient(app, { platform: 'mobile', origin: null });
  const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
  const { tokens } = AuthResponseSchema.parse(res.body);
  return { client, auth: `Bearer ${tokens!.accessToken}` };
}

describe('OrderItems (e2e)', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  it('no deja leer recursos de otro usuario', async () => {
    const ana = await signUp(app);
    const eva = await signUp(app);
    const res = await ana.client
      .post('/v1/order-items')
      .set('authorization', ana.auth)
      .send({ name: 'x' })
      .expect(201);
    const { id } = OrderItemSchema.parse(res.body);
    await eva.client.get(`/v1/order-items/${id}`).set('authorization', eva.auth).expect(404);
  });
});
```

Con `platform: 'mobile'` los tokens llegan en el cuerpo y no hay cookies ni CSRF; para probar web, usa
`platform: 'web'` (el `agent` de supertest guarda las cookies) y el `origin` por defecto (`ALLOWED_ORIGIN`).

## 6. Definition of Done y revisión de código

### Definition of Done

Un cambio está terminado cuando:

- [ ] Ha seguido el [orden de trabajo](#1-orden-obligatorio-de-trabajo) y la funcionalidad está en `FEATURES`.
- [ ] El contrato está en `@rulet/shared` y API y clientes lo usan en el mismo PR.
- [ ] Si hay tabla nueva o cambiada, la migración generada y revisada está en `apps/api/drizzle/`.
- [ ] Hay tests unitarios del service y e2e de los endpoints (incluido el 404 entre usuarios y el 401 sin sesión).
- [ ] `pnpm check`, `pnpm test:e2e` y `pnpm build` pasan en local; CI (`CI` y `Security`) en verde.
- [ ] Variables de entorno nuevas en el esquema `env`, `.env.example` y [environments.md](./environments.md).
- [ ] Documentación y, si procede, ADR actualizados; plantillas de generadores al día si cambió la estructura.
- [ ] La plantilla de PR (`.github/pull_request_template.md`) está completa, incluida la sección de seguridad.

### Checklist de revisión

Complementa la [checklist de seguridad de cada PR](./security.md#a-en-cada-pr).

Arquitectura:

- [ ] El controller no inyecta `DATABASE` ni repositorios y no tiene lógica; el service no importa Drizzle.
- [ ] El repositorio no se exporta del módulo; otros módulos usan el service.
- [ ] Ningún archivo nuevo lee `process.env` fuera de los módulos `env`.
- [ ] Las pantallas de `src/app` solo importan de `features/<f>/index.ts`; ningún componente llama a `fetch` ni
      importa `lib/api`.
- [ ] Imports relativos con `.js` en la API; nada de `@rulet/*/src/*`.

Seguridad:

- [ ] Ninguna ruta nueva es `@Public()` sin justificación escrita.
- [ ] El propietario sale de `@CurrentUser()` y **todas** las consultas del repositorio filtran por `user_id`.
- [ ] Peticiones con `z.strictObject`, cadenas con `.max()`, ids con `ParseUUIDPipe`, listados con `.limit()`.
- [ ] La respuesta se construye con lista blanca y no expone `userId` ni datos internos.
- [ ] No se registran datos sensibles; los mensajes de error al usuario son fijos.
- [ ] Los cambios en `apps/api/src/modules/auth/`, `apps/api/src/common/`, `packages/shared/src/contracts/`,
      `apps/api/src/database/`, `apps/api/drizzle/` o `.github/` los revisa el code owner (`.github/CODEOWNERS`).

Datos:

- [ ] El SQL de la migración hace lo que dice el esquema, no rompe la versión desplegada y no edita migraciones ya
      fusionadas.
- [ ] La unicidad y la concurrencia se resuelven con restricciones o `UPDATE` condicionales, no con `SELECT` previo.

## 7. Flujo git

1. **Rama** desde `main`, corta y de un solo tema: `<tipo>/<tema-en-kebab-case>` con los tipos de commit
   (`feat/order-items`, `fix/refresh-race`, `docs/manual`).
2. **Commits** en Conventional Commits, comprobados por commitlint (`commitlint.config.mjs`) en el hook
   `commit-msg`:

   ```
   <tipo>(<ámbito>): <descripción en minúscula e imperativo, sin punto final>
   ```

   | Regla                  | Valores                                                                                                        |
   | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
   | Tipos (`type-enum`)    | `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`                            |
   | Ámbito **obligatorio** | `api`, `web`, `mobile`, `shared`, `api-client`, `design-tokens`, `eslint-config`, `repo`, `deps`, `ci`, `docs` |
   | Cabecera               | ≤ 100 caracteres; la descripción no empieza por mayúscula (`subject-case`)                                     |
   | Cuerpo y pie           | Líneas ≤ 100 caracteres                                                                                        |

   Varios ámbitos se separan por coma (`feat(api,web): …`). `packages/tsconfig`, `turbo/generators` y la raíz usan
   `repo`. Un cambio incompatible se marca con `!` (`feat(api)!: …`).

3. **Hooks** (Husky, instalados por `pnpm install`):
   - `pre-commit` → `lint-staged` → `prettier --write --ignore-unknown` sobre los archivos preparados.
   - `commit-msg` → `commitlint --edit "$1"`.
   - No ejecutan lint, typecheck ni tests: eso es `pnpm check`. No se saltan con `--no-verify`.
4. **PR** contra `main` con la plantilla completa. Un PR que cambia un contrato incluye API **y** clientes.
5. **CI**: `CI` (formato, `boundaries`, `lint typecheck test build`, migraciones y e2e contra Postgres, build y
   Trivy de las imágenes) y `Security` (CodeQL, revisión de dependencias, gitleaks, `pnpm audit --prod`) en verde.
6. **Fusión con squash**: el título del PR es el mensaje final y sigue las mismas reglas de commitlint.

## 8. Limitaciones conocidas

Estado actual del repositorio que afecta al día a día. Si resuelves alguna, actualiza esta lista.

- `pnpm check` no incluye `test:e2e` ni `build`; hay que ejecutarlos aparte (CI sí los ejecuta).
- `turbo gen` termina con código 0 aunque el generador falle; los generadores no crean la migración (`db:generate`)
  ni el test e2e, y el primer `pnpm gen` puede necesitar red para descargar `@turbo/gen`.
- No hay paginación en la API ni en los generadores (solo el tope de 100 filas).
- No hay tests de componentes (sin Testing Library) ni e2e de navegador o dispositivo (sin Playwright ni Detox):
  la UI se prueba a mano.
- Nadie comprueba automáticamente la separación controller → service → repository: depende de la revisión.
- El rate limiting guarda los contadores en memoria de cada proceso: con varias réplicas el límite se multiplica.
- No hay limpieza periódica de sesiones caducadas o revocadas (`sessions` crece).
