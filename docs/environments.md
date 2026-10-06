# Entornos y despliegue

Referencia de los entornos, de **todas** las variables de entorno (leídas de los esquemas reales) y de los workflows
de GitHub Actions. Guías relacionadas:

- [GitHub y despliegue](./github-and-deployment.md): Codespaces, GHCR, opciones de proveedor y la ruta de despliegue
  paso a paso.
- [Base de datos](./database.md): migraciones, TLS, roles, copias de seguridad y PostgreSQL en local.
- [Seguridad § 7](./security.md#7-gestión-de-secretos): dónde vive cada secreto y cómo rotarlo.

## Entornos

| Entorno                                            | API                                                                         | Web                                 | Móvil (variante · bundle id)        | BD                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- | ------------------------------------- |
| **Desarrollo** (local, Dev Container o Codespaces) | `pnpm dev:api` → `:3000`, `NODE_ENV=development`                            | `pnpm dev:web` → `:3001`            | `development` · `com.rulet.app.dev` | `rulet` en `localhost:5432`           |
| **Test** (local y CI)                              | e2e con supertest, `NODE_ENV=test`                                          | —                                   | —                                   | `rulet_test`                          |
| **Local "como producción"**                        | `docker compose up --build`, imagen de producción con `NODE_ENV=production` | Imagen de producción en `:3001`     | —                                   | Servicio `db` de `docker-compose.yml` |
| **Preview**                                        | No existe                                                                   | No existe                           | `preview` · `com.rulet.app.preview` | —                                     |
| **Producción**                                     | Imagen `rulet-api` de GHCR                                                  | Imagen `rulet-web` de GHCR o Vercel | `production` · `com.rulet.app`      | PostgreSQL gestionado con TLS         |

- Las tres variantes móviles tienen bundle id distinto, así que pueden convivir instaladas en el mismo dispositivo.
- **No hay** entorno de staging ni despliegues de previsualización por PR para API y web: ningún workflow despliega
  ([GitHub y despliegue § 10](./github-and-deployment.md#10-limitaciones-y-trabajo-pendiente)). `preview` solo
  existe como variante de build de la app móvil.

## Variables de entorno

Cada app valida sus variables con Zod al arrancar o compilar; si una es inválida, el proceso no arranca (o el build
falla) con un mensaje que nombra la variable. **Nunca se commitean secretos**: los `.env` están en `.gitignore` y
`.dockerignore`.

| App              | Archivo local         | Plantilla                  | Esquema                                                         |
| ---------------- | --------------------- | -------------------------- | --------------------------------------------------------------- |
| API              | `apps/api/.env`       | `apps/api/.env.example`    | `apps/api/src/config/env.ts`                                    |
| Web              | `apps/web/.env.local` | `apps/web/.env.example`    | `apps/web/src/lib/env.ts` (lo importa `next.config.ts`)         |
| Móvil            | `apps/mobile/.env`    | `apps/mobile/.env.example` | `apps/mobile/src/lib/env-config.ts`, `env.ts` y `app.config.ts` |
| `docker compose` | `.env` (raíz)         | `.env.example` (raíz)      | El de la API (compose arranca la imagen de producción)          |

Cómo se cargan:

- **API**: `ConfigModule.forRoot()` lee `apps/api/.env` del directorio de trabajo; las variables ya definidas en el
  entorno del proceso tienen prioridad. En la imagen no hay `.env`: todo llega del entorno.
- **Migrador** (`node dist/database/migrate.js`): **no** carga `.env`; solo lee el entorno.
- **drizzle-kit** (`db:generate`, `db:migrate`, `db:studio`): `drizzle.config.ts` carga `apps/api/.env` con
  `process.loadEnvFile` si existe; las variables del entorno tienen prioridad.
- **Turborepo** no carga `.env` y funciona en modo estricto: a las tareas solo les llegan las variables declaradas
  en `turbo.json` (`env`, `passThroughEnv`). Por eso CI ejecuta `db:migrate` y `test:e2e` con `pnpm --filter` y no
  con `turbo`.
- **Booleanos** (`DATABASE_SSL`, `COOKIE_SECURE`…): solo `true`, `false`, `1` o `0`. Cualquier otro valor
  (`yes`, `TRUE`, vacío) es un error, no `false`.

> Las variables `NEXT_PUBLIC_*` y `EXPO_PUBLIC_*` acaban en el bundle del cliente: son **públicas**. Nunca pongas
> secretos en ellas.

### API (`apps/api/.env`)

"Producción" indica la regla extra que se aplica con `NODE_ENV=production`.

| Variable                      | Por defecto                                     | Producción                                                                                                                              | Descripción                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | `development`                                   | `production`                                                                                                                            | `development` · `test` · `production`. Activa las reglas de producción, logs JSON y `COOKIE_SECURE=true`                                                                                                                                                                                      |
| `PORT`                        | `3000`                                          | —                                                                                                                                       | Puerto HTTP (entero positivo)                                                                                                                                                                                                                                                                 |
| `APP_VERSION`                 | `0.0.0`                                         | Recomendada                                                                                                                             | Versión que devuelve `GET /health`. Ningún workflow la inyecta                                                                                                                                                                                                                                |
| `CORS_ORIGINS`                | `http://localhost:3001`                         | **Obligatoria**, sin valor por defecto; solo `https://`; `localhost` solo con `ALLOW_LOCALHOST_CORS=true`                               | Orígenes exactos `esquema://host[:puerto]` separados por comas, sin ruta ni barra final. `*` no es un origen válido                                                                                                                                                                           |
| `ALLOW_LOCALHOST_CORS`        | `false`                                         | Nunca en un despliegue real                                                                                                             | Escape para que una API en producción acepte orígenes `localhost` (solo `docker compose` local)                                                                                                                                                                                               |
| `TRUST_PROXY`                 | `loopback`                                      | **Obligatoria**, sin valor por defecto                                                                                                  | Proxies de confianza para leer la IP de `X-Forwarded-For` (clave del rate limiting): `false`, nº de saltos `1`–`10`, o lista de IP/CIDR o `loopback`/`linklocal`/`uniquelocal`. `true` y `0` se rechazan. Ver [cómo elegirla](./github-and-deployment.md#paso-4--api)                         |
| `THROTTLE_TTL_MS`             | `60000`                                         | —                                                                                                                                       | Ventana del rate limit global, en ms                                                                                                                                                                                                                                                          |
| `THROTTLE_LIMIT`              | `100`                                           | —                                                                                                                                       | Peticiones por ventana e IP. Auth tiene además límites propios. Contadores en memoria de cada proceso                                                                                                                                                                                         |
| `DATABASE_URL`                | — (**obligatoria**)                             | Secreto; rol `rulet_app`                                                                                                                | URL `postgres://` o `postgresql://`. Sin parámetros TLS: se rechazan `ssl`, `sslnegotiation`, `uselibpqcompat` y cualquier `sslmode` salvo `verify-full`; `sslmode=verify-full`, `sslrootcert`, `sslcert` y `sslkey` solo con `DATABASE_SSL=true` ([detalle](./database.md#6-conexión-y-tls)) |
| `DATABASE_SSL`                | `false`                                         | **`true`** (salvo `DATABASE_SSL_ALLOW_INSECURE=true`)                                                                                   | TLS hacia la BD verificando el certificado (`rejectUnauthorized: true`). Única fuente de verdad sobre TLS                                                                                                                                                                                     |
| `DATABASE_SSL_ALLOW_INSECURE` | `false`                                         | Nunca en un despliegue real                                                                                                             | Escape para producción sin TLS en una red privada (solo `docker compose` local)                                                                                                                                                                                                               |
| `DATABASE_POOL_MAX`           | `10`                                            | Réplicas × valor < `max_connections`                                                                                                    | Conexiones máximas del pool por instancia (1–100)                                                                                                                                                                                                                                             |
| `JWT_ACCESS_SECRET`           | — (**obligatoria**)                             | Secreto; se rechazan los que contienen `insecure`, `not-a-secret`, `dev-only`, `devcontainer`, `test-only`, `cambia-esto` o `change-me` | Secreto HS256 de los access tokens, mínimo 32 caracteres. Genera uno con `openssl rand -base64 48`, distinto por entorno                                                                                                                                                                      |
| `JWT_ISSUER`                  | `rulet-api`                                     | —                                                                                                                                       | Claim `iss` que se firma y se exige                                                                                                                                                                                                                                                           |
| `JWT_AUDIENCE`                | `rulet-clients`                                 | —                                                                                                                                       | Claim `aud` que se firma y se exige                                                                                                                                                                                                                                                           |
| `COOKIE_SECURE`               | `true` si `NODE_ENV=production`; si no, `false` | Sin definir o `true`                                                                                                                    | Cookies web con `Secure` y prefijos `__Host-`/`__Secure-` (requiere HTTPS)                                                                                                                                                                                                                    |

El migrador valida solo `NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_ALLOW_INSECURE` y
`DATABASE_POOL_MAX`, con las mismas reglas (`validateDatabaseEnv()`).

Variable solo de tests: `TEST_DATABASE_URL` sustituye la URL de los e2e (por defecto
`postgres://rulet:rulet@localhost:5432/rulet_test`; el nombre de la BD debe terminar en `_test`). Ver
[Base de datos § 11](./database.md#11-bd-de-tests).

### Web (`apps/web/.env.local`)

| Variable              | Por defecto             | Producción                                                       | Descripción                                                                                                                                                                                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | `https://` obligatorio (salvo `localhost`, `127.0.0.1`, `[::1]`) | Origen de la API, sin versión (el cliente añade `/v1`). Sin credenciales, query ni fragmento. Se incrusta en el bundle **en el build** y se usa en `connect-src` de la CSP: debe ser exactamente el origen al que llama el navegador |

- `NODE_ENV` lo fija Next (`development` en `next dev`, `production` en `next build`/`next start`).
- **Ojo**: si falta en el build, se usa `http://localhost:3000` también en producción, y la validación lo admite
  (`localhost` está permitido). `release.yml` lo evita fallando si la variable de repositorio no existe.
- Cambiar la URL exige **volver a construir** la web.
- Variables de ejecución de la imagen (`apps/web/Dockerfile`): `PORT=3001`, `HOSTNAME=0.0.0.0`,
  `NEXT_TELEMETRY_DISABLED=1`.

### Móvil (`apps/mobile/.env`)

| Variable              | Por defecto                                                                             | `preview` / `production`        | Descripción                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Solo en `development`: `http://10.0.2.2:3000` (Android) o `http://localhost:3000` (iOS) | **Obligatoria** y `https://`    | Origen de la API, sin versión. Se incrusta en el build. Con un dispositivo físico en desarrollo, la IP de tu equipo (p. ej. `http://192.168.1.20:3000`) |
| `APP_VARIANT`         | `development` en local; **obligatoria** en EAS                                          | La fija el perfil de `eas.json` | `development` · `preview` · `production`. Decide nombre, bundle id y reglas. Un valor desconocido es un error                                           |
| `EAS_BUILD`           | (la define EAS en sus workers)                                                          | —                               | Si existe, `app.config.ts` exige `APP_VARIANT`                                                                                                          |

Dónde se valida:

- **En build** (`app.config.ts`): `APP_VARIANT` válida (y obligatoria en EAS); fuera de `development`, si
  `EXPO_PUBLIC_API_URL` está definida, debe empezar por `https://`.
- **Al arrancar** (`src/lib/env.ts` → `readApiUrl()`): fuera de `development` la URL es obligatoria y `https`; si
  falta, la app falla al arrancar a propósito. La variante llega en `extra.variant`; si no se reconoce, se aplican
  las reglas de `production`.
- Solo en `development` se permite `http://` hacia IPs de la red local (`allowInsecureHttp`).

### `docker compose` (`.env` de la raíz)

`docker-compose.yml` levanta `db` (PostgreSQL 17), `migrate` (paso único), `api` y `web` con las imágenes de
producción. El `.env` de la raíz solo necesita **una** variable; el resto está fijado en el compose y es público:

| Variable                                              | Dónde                               | Valor                                                                           |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                                   | `.env` de la raíz (**obligatoria**) | Genera uno con `openssl rand -base64 48`; sin ella la API no arranca (la BD sí) |
| `NODE_ENV`                                            | `migrate`, `api`                    | `production`                                                                    |
| `DATABASE_URL`                                        | `migrate`, `api`                    | `postgres://rulet:rulet@db:5432/rulet`                                          |
| `DATABASE_SSL` / `DATABASE_SSL_ALLOW_INSECURE`        | `migrate`, `api`                    | `false` / `true` (red privada de compose)                                       |
| `PORT`                                                | `api`                               | `3000`                                                                          |
| `CORS_ORIGINS` / `ALLOW_LOCALHOST_CORS`               | `api`                               | `http://localhost:3001` / `true`                                                |
| `TRUST_PROXY`                                         | `api`                               | `false` (puerto publicado directamente, sin proxy)                              |
| `COOKIE_SECURE`                                       | `api`                               | `false` (HTTP local)                                                            |
| `NEXT_PUBLIC_API_URL`                                 | `web` (`build.args`)                | `http://localhost:3000`                                                         |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `db`                                | `rulet` / `rulet` / `rulet` (+ `rulet_test` vía `init-test-db.sql`)             |

```bash
cp .env.example .env     # y define JWT_ACCESS_SECRET
docker compose up --build   # API en http://localhost:3000, web en http://localhost:3001
docker compose down         # añade -v para borrar también los datos de la BD
```

Los puertos solo se publican en `127.0.0.1`. Estas credenciales no sirven para ningún entorno desplegado.

### Dev Container y CI

| Variable                      | Dev Container (`.devcontainer/docker-compose.yml`, servicio `app`)                             | CI (`ci.yml`, job `quality`)                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | `postgres://rulet:rulet@localhost:5432/rulet`                                                  | `postgres://rulet:rulet_ci@localhost:5432/rulet_test`                                         |
| `TEST_DATABASE_URL`           | — (usa el valor por defecto)                                                                   | `postgres://rulet:rulet_ci@localhost:5432/rulet_test`                                         |
| `DATABASE_SSL`                | `false`                                                                                        | `false`                                                                                       |
| `JWT_ACCESS_SECRET`           | `devcontainer-only-insecure-…` (público)                                                       | `ci-only-not-a-secret-…` (público)                                                            |
| `COOKIE_SECURE`               | `false`                                                                                        | `false`                                                                                       |
| `CORS_ORIGINS`                | —                                                                                              | `http://localhost:3001`                                                                       |
| `JWT_ISSUER` / `JWT_AUDIENCE` | —                                                                                              | `rulet-api` / `rulet-clients`                                                                 |
| Otras                         | `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`, `TURBO_TELEMETRY_DISABLED=1`, `NEXT_TELEMETRY_DISABLED=1` | `HUSKY=0`, `TURBO_TELEMETRY_DISABLED=1`; `NODE_ENV=test` solo en los pasos de migración y e2e |

Con `pnpm dev` (Turborepo, modo estricto) las variables del contenedor no llegan a la API, que usa
`apps/api/.env`; con `pnpm dev:api` sí tienen prioridad.

### Añadir una variable

1. Esquema (`env.ts` de la app) con valor por defecto o regla de producción.
2. `.env.example` de la app, con un comentario.
3. Esta página.
4. Si afecta al build, `env` de la tarea en `turbo.json` (hoy: `APP_VARIANT`; las `NEXT_PUBLIC_*` y
   `EXPO_PUBLIC_*` las detecta Turborepo solo). Si un test la necesita en ejecución, `passThroughEnv`.
5. ESLint (`packages/eslint-config/base.js`) prohíbe leer `process.env` fuera de los módulos de entorno, el
   migrador y los tests: el resto recibe la configuración validada.

## Despliegue

Orden de cada versión: **migrar → API → web**. La guía completa, con proveedores, variables y comprobaciones, está
en [GitHub y despliegue § 7](./github-and-deployment.md#7-ruta-recomendada-paso-a-paso).

```mermaid
flowchart LR
  m["migrate<br/>node dist/database/migrate.js"] -->|código 0| a["API<br/>node dist/main.js"] --> w["Web<br/>node apps/web/server.js"]
```

### API — contenedor

```bash
docker build -f apps/api/Dockerfile -t rulet-api .     # desde la raíz del monorepo
docker run --rm --env-file api.env rulet-api node dist/database/migrate.js   # 1. migraciones, una vez
docker run -p 3000:3000 --env-file api.env rulet-api                         # 2. API, n réplicas
```

`api.env` es un ejemplo de archivo fuera del repositorio. En producción usa la imagen de GHCR por digest.

- La imagen ejecuta como `node`, con el código de root y sin permisos de escritura, solo dependencias de producción
  (`pnpm deploy --prod`) y las migraciones (`drizzle/`). Declara `HEALTHCHECK` contra `/health`.
- Sondas: liveness `GET /health` (no toca la BD) y readiness `GET /health/ready` (`503` si la BD no responde en
  2 s).
- El balanceador debe enviar `SIGTERM` y esperar unos segundos (apagado ordenado; se cierra el pool) y, si lo genera,
  reenviar `x-request-id`.
- La migración debe ser compatible con la versión anterior de la API, que sigue sirviendo mientras tanto
  ([Base de datos § 4](./database.md#4-migraciones-sin-caída-expandcontract)).

### Web — contenedor o Vercel

- **Contenedor**:
  `docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.rulet.app -t rulet-web .`
  (`output: 'standalone'`; arranca con `node apps/web/server.js` en el puerto 3001).
- **Vercel**: proyecto con _Root Directory_ `apps/web` y `NEXT_PUBLIC_API_URL` en sus variables. Esa build no pasa
  por Trivy ni por la atestación de `release.yml`.
- La CSP lleva un nonce por petición (`src/proxy.ts`): el HTML se renderiza bajo demanda y no se puede servir como
  estático ni cachear en una CDN.
- Web y API en el **mismo site** (p. ej. `rulet.app` y `api.rulet.app`) para que viajen las cookies `SameSite`, y
  `CORS_ORIGINS` de la API con el origen exacto de la web.

### Móvil — EAS

```bash
cd apps/mobile
npx eas build --profile preview       # build interno para testers (APP_VARIANT=preview)
npx eas build --profile production    # build para tiendas (APP_VARIANT=production, autoIncrement)
npx eas submit --profile production   # subir a App Store / Play
```

- Los perfiles están en `apps/mobile/eas.json` y cada uno fija `APP_VARIANT` en su `env`. Un perfil nuevo debe
  fijarla también: sin ella, la build de EAS falla.
- `EXPO_PUBLIC_API_URL` (`https://…`) **por perfil** para `preview` y `production`: en `env` del perfil de `eas.json`
  (no es secreta) o como variable de entorno de EAS. Sin ella la build se genera, pero la app falla al arrancar.
- **No hay actualizaciones OTA**: `expo-updates` no está instalado, así que los `channel` de `eas.json` no tienen
  efecto y cada cambio (también de JS) requiere una build nueva.

### Local, como en producción

```bash
docker compose up --build   # db → migrate → API en :3000 → web en :3001
```

Ver la sección [`docker compose`](#docker-compose-env-de-la-raíz).

## CI/CD

Las actions están fijadas a un SHA completo (Dependabot las actualiza) y cada workflow pide permisos mínimos.

### `ci.yml` — en cada PR y push a `main`

| Job       | Nombre del check                  | Pasos                                                                                                                                                                                                  |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quality` | `Lint · Typecheck · Test · Build` | `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm boundaries`, `pnpm turbo run lint typecheck test build`, `db:migrate` y `test:e2e` contra el servicio `postgres:17-alpine` (`rulet_test`) |
| `docker`  | `Docker (api)`, `Docker (web)`    | Build de cada imagen (sin publicar) y Trivy (`CRITICAL,HIGH` con parche). La web se construye con `NEXT_PUBLIC_API_URL=https://api.example.com`                                                        |

### `security.yml` — PR, push a `main`, lunes 04:23 UTC y manual

| Job                 | Nombre del check                         | Qué hace                                                                  |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `codeql`            | `CodeQL`                                 | `security-extended` para JavaScript/TypeScript                            |
| `dependency-review` | `Revisión de dependencias`               | Solo en PR: bloquea dependencias nuevas con vulnerabilidades `high` o más |
| `secrets`           | `Secretos (gitleaks)`                    | Commits nuevos en PR/push; todo el historial en la semanal y la manual    |
| `audit`             | `Auditoría de dependencias (pnpm audit)` | `pnpm audit --prod --audit-level=high` (excepciones en `SECURITY.md`)     |

### `release.yml` — tras `CI` en verde de un push a `main`

Publica `ghcr.io/<owner>/rulet-api` y `ghcr.io/<owner>/rulet-web`: sube `sha-<commit>`, lo escanea con Trivy por
digest, lo atesta (procedencia SLSA, SBOM y firma Sigstore) y solo entonces mueve `latest`. Necesita la variable de
repositorio `NEXT_PUBLIC_API_URL`. Detalle y verificación con `gh attestation verify`:
[GitHub y despliegue § 3](./github-and-deployment.md#3-ghcr-imágenes-publicadas) y
[§ 9](./github-and-deployment.md#9-verificar-la-procedencia-de-una-imagen).

### Dependabot

`.github/dependabot.yml`: npm semanal (agrupado en `nestjs`, `expo`, `next`, `lint`; espera 3 días antes de
proponer una versión recién publicada), GitHub Actions mensual e imágenes Docker de `apps/api` y `apps/web`
semanal.

Los ajustes del repositorio que no se pueden versionar (protección de rama, checks obligatorios, private
vulnerability reporting, variable `NEXT_PUBLIC_API_URL`, paquetes de GHCR) están en
[GitHub y despliegue § 8](./github-and-deployment.md#8-ajustes-manuales-del-repositorio-en-github).
