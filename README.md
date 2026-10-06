# Rulet

Producto **mobile-first**: app móvil en React Native (Expo), web en Next.js y API en NestJS sobre PostgreSQL, en un
monorepo TypeScript con **pnpm** y **Turborepo**.

```
rulet/
├── apps/
│   ├── mobile/          📱 App principal — Expo SDK 57 · React Native · expo-router · EAS
│   ├── web/             🌐 Web — Next.js 16 App Router
│   └── api/             ⚙️  API — NestJS 12 (ESM) · REST versionada (/v1) · Drizzle ORM · PostgreSQL
├── packages/
│   ├── shared/          Contratos HTTP (Zod), dominio y catálogo de features por plataforma
│   ├── api-client/      Cliente HTTP tipado que comparten web y móvil (sesión, renovación, errores)
│   ├── design-tokens/   Colores, espaciado y tipografía comunes
│   ├── eslint-config/   Reglas de lint, de arquitectura y de seguridad
│   └── tsconfig/        Configuración base de TypeScript
├── turbo/generators/    Generadores de código (`pnpm gen`)
├── .devcontainer/       Codespaces / Dev Containers (Node 24 + PostgreSQL 17)
├── docker-compose.yml   Entorno local "como en producción" (db + migrate + api + web)
└── docs/                Arquitectura, manual de desarrollo, seguridad, base de datos, despliegue y ADRs
```

## Principios

- **Una fuente de verdad por concepto**: los contratos de la API, las funcionalidades por plataforma y los tokens de
  diseño se definen una vez en `packages/` y se usan en todas partes.
- **Cada plataforma tiene su UI**: lo exclusivo de web o de móvil vive en `apps/<plataforma>/src/features`; lo común,
  en `packages/`.
- **Seguro por defecto**: toda ruta de la API exige autenticación salvo `@Public()`, toda entrada se valida con Zod y
  la configuración insegura impide arrancar en producción.
- **La arquitectura se hace cumplir sola**: los límites entre paquetes y plataformas los comprueban
  `turbo boundaries` y ESLint en CI.
- **Fallar pronto**: variables de entorno y respuestas de la API se validan en runtime.

Lee la [arquitectura](./docs/architecture.md) para la visión completa y el
[manual de desarrollo](./docs/development-guide.md) antes de tu primer cambio.

## ¿Se puede levantar en GitHub, con la base de datos?

| Para qué       | ¿En GitHub? | Cómo                                                                                                     |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Desarrollar    | **Sí**      | Codespaces (`.devcontainer/`): Node 24 y PostgreSQL 17 con `rulet` y `rulet_test`, migraciones aplicadas |
| CI y tests e2e | **Sí**      | GitHub Actions (`ci.yml`) con un PostgreSQL 17 temporal por ejecución                                    |
| Imágenes       | **Sí**      | `release.yml` publica `rulet-api` y `rulet-web` en GHCR (SBOM, procedencia y atestación)                 |
| Producción     | **No**      | GitHub no da cómputo permanente ni PostgreSQL gestionado (Pages solo sirve estáticos): proveedor externo |

Detalle, opciones de proveedor y la ruta de despliegue paso a paso:
[GitHub y despliegue](./docs/github-and-deployment.md).

## Requisitos

| Herramienta | Versión                                              | Cómo                          |
| ----------- | ---------------------------------------------------- | ----------------------------- |
| Node.js     | 24 (`.nvmrc`; `package.json` exige `"node": ">=24"`) | `nvm use`                     |
| pnpm        | 10 (`packageManager`: `pnpm@10.28.0`)                | `corepack enable pnpm`        |
| PostgreSQL  | 17 en Dev Container, compose y CI                    | Una de las tres vías de abajo |
| Docker      | Opcional: compose y Dev Container                    | —                             |

`pnpm install` ejecuta `prepare` (`husky || true`), que instala los hooks de git `pre-commit` (Prettier sobre lo
añadido) y `commit-msg` (commitlint).

## Puesta en marcha

La API no arranca sin `DATABASE_URL` y `JWT_ACCESS_SECRET` (`apps/api/src/config/env.ts`). Elige **una** vía para
tener PostgreSQL.

### Vía 1 — Codespaces o Dev Container (recomendada)

En GitHub, **Code → Codespaces → Create codespace on main**, o en VS Code con la extensión Dev Containers,
**Reopen in Container**. El contenedor (`.devcontainer/`) levanta PostgreSQL 17 con las bases `rulet` y
`rulet_test` (usuario `rulet`, contraseña `rulet`) y `post-create.sh` instala dependencias, copia los `.env.example`
que falten y aplica las migraciones a `rulet`. Después:

```bash
pnpm dev
```

La web autentica con cookies `SameSite`: ábrela por los puertos reenviados a `localhost` (VS Code o
`gh codespace ports forward 3000:3000 3001:3001`), no por las URLs públicas `*.app.github.dev`, que son _sites_
distintos y no envían las cookies.

### Vía 2 — PostgreSQL con `docker compose` y apps con `pnpm dev`

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

docker compose up -d db   # PostgreSQL 17 en 127.0.0.1:5432 con las bases rulet y rulet_test
```

El servicio `db` usa las mismas credenciales que `apps/api/.env.example` y los tests (`rulet`/`rulet`), así que no
hay que tocar ninguna URL. El `.env` de la raíz (`cp .env.example .env` con un `JWT_ACCESS_SECRET` generado) solo
hace falta para levantar también la API y la web con `docker compose up --build`.

```bash
pnpm --filter @rulet/api db:migrate   # aplica apps/api/drizzle/ a DATABASE_URL
pnpm dev
```

### Vía 3 — PostgreSQL instalado en tu máquina

Crea el usuario y las dos bases que esperan los valores por defecto (`apps/api/.env.example` y
`apps/api/test/test-env.ts`):

```bash
psql -U postgres -c "CREATE ROLE rulet LOGIN PASSWORD 'rulet'"
psql -U postgres -c "CREATE DATABASE rulet OWNER rulet"
psql -U postgres -c "CREATE DATABASE rulet_test OWNER rulet"
```

Copia los `.env` como en la vía 2 (sin tocar `DATABASE_URL`) y:

```bash
pnpm install
pnpm --filter @rulet/api db:migrate
pnpm dev
```

Más detalle sobre la BD local y la de tests: [Base de datos §11–§12](./docs/database.md#11-bd-de-tests).

### Qué se levanta

| Comando           | Qué arranca                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `pnpm dev`        | Todo a la vez (`turbo run dev`)                                     |
| `pnpm dev:api`    | API en `http://localhost:3000` (`GET /health`, `GET /health/ready`) |
| `pnpm dev:web`    | Web en `http://localhost:3001`                                      |
| `pnpm dev:mobile` | Expo (`expo start`): Expo Go o development build                    |

En el emulador de Android la API local es `http://10.0.2.2:3000` (valor por defecto en desarrollo); en un
dispositivo físico, define `EXPO_PUBLIC_API_URL` con la IP de tu equipo. Ver
[`apps/mobile/README.md`](./apps/mobile/README.md).

### Archivos `.env`

Ninguno se versiona (`.gitignore`); cada uno tiene su `.env.example` comentado con todas las variables.

| Archivo               | Se copia de                | Lo lee                                   | Variables clave                                                                     |
| --------------------- | -------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/api/.env`       | `apps/api/.env.example`    | API (`@nestjs/config`) y drizzle-kit     | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, `TRUST_PROXY`, `COOKIE_SECURE` |
| `apps/web/.env.local` | `apps/web/.env.example`    | Next.js (se incrusta en el build)        | `NEXT_PUBLIC_API_URL`                                                               |
| `apps/mobile/.env`    | `apps/mobile/.env.example` | Expo (se incrusta en el bundle)          | `EXPO_PUBLIC_API_URL` (opcional en desarrollo)                                      |
| `.env` (raíz)         | `.env.example`             | `docker compose` (sustitución de `${…}`) | `JWT_ACCESS_SECRET`                                                                 |

Genera los secretos con `openssl rand -base64 48`. El valor de `apps/api/.env.example` es un marcador que la API
rechaza con `NODE_ENV=production`. Todas las variables y sus reglas: [Entornos y despliegue](./docs/environments.md).

### Todo en contenedores, como en producción

```bash
cp .env.example .env      # define JWT_ACCESS_SECRET
docker compose up --build # db → migrate (one-shot) → api :3000 → web :3001
docker compose down       # -v borra también los datos de la BD
```

Usa las imágenes de producción (`NODE_ENV=production`) con escapes explícitos para HTTP local
(`ALLOW_LOCALHOST_CORS`, `DATABASE_SSL_ALLOW_INSECURE`, `COOKIE_SECURE=false`). Sus credenciales son públicas: solo
para tu máquina.

## Comandos

| Comando           | Qué hace                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `pnpm check`      | Lint, tipos, tests unitarios, formato y límites. **No** incluye `build` ni `test:e2e` |
| `pnpm build`      | Build de todos los paquetes y apps                                                    |
| `pnpm test`       | Tests unitarios (Vitest)                                                              |
| `pnpm test:e2e`   | Tests e2e de la API contra PostgreSQL (BD cuyo nombre termine en `_test`)             |
| `pnpm lint`       | ESLint (incluye reglas de arquitectura y seguridad)                                   |
| `pnpm typecheck`  | TypeScript                                                                            |
| `pnpm format`     | Formatea con Prettier (`format:check` solo comprueba)                                 |
| `pnpm boundaries` | Verifica que ningún paquete dependa de una app                                        |
| `pnpm gen`        | Generadores de código ([`turbo/generators/README.md`](./turbo/generators/README.md))  |
| `pnpm audit:prod` | `pnpm audit` de dependencias de producción (nivel `high`)                             |

Base de datos (scripts de `apps/api`, leen `apps/api/.env`):

| Comando                                | Qué hace                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm --filter @rulet/api db:generate` | Genera una migración SQL en `apps/api/drizzle/` a partir de `src/database/schema` |
| `pnpm --filter @rulet/api db:migrate`  | Aplica las migraciones pendientes a `DATABASE_URL` (drizzle-kit)                  |
| `pnpm --filter @rulet/api db:studio`   | Abre Drizzle Studio sobre `DATABASE_URL`                                          |

En despliegue las migraciones se aplican con `node dist/database/migrate.js` desde la imagen de la API, antes de
arrancar las réplicas ([Base de datos](./docs/database.md)).

Para un paquete concreto: `pnpm --filter @rulet/<paquete> <script>`.

## Documentación

Índice completo y orden de lectura: [`docs/README.md`](./docs/README.md).

| Documento                                              |                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| [Arquitectura](./docs/architecture.md)                 | Piezas, reglas de dependencia, tubería de la API, anatomía de cada app   |
| [Manual de desarrollo](./docs/development-guide.md)    | Orden de trabajo obligatorio, capas, patrones, tests, Definition of Done |
| [Seguridad](./docs/security.md)                        | Modelo de amenazas, autenticación, secretos, checklists                  |
| [Base de datos](./docs/database.md)                    | Esquema, migraciones y repositorios                                      |
| [Añadir una funcionalidad](./docs/adding-a-feature.md) | Del contrato a la UI, paso a paso                                        |
| [Convenciones](./docs/conventions.md)                  | Nombres, commits, ramas, PRs                                             |
| [Entornos y despliegue](./docs/environments.md)        | Variables, entornos, Docker, EAS                                         |
| [GitHub y despliegue](./docs/github-and-deployment.md) | CI, seguridad, publicación de imágenes y ajustes del repositorio         |
| [Decisiones (ADR)](./docs/adr/README.md)               | Por qué está construido así                                              |
| [Contribuir](./CONTRIBUTING.md)                        | Flujo de trabajo                                                         |
| [Política de seguridad](./SECURITY.md)                 | Cómo informar de una vulnerabilidad (nunca en issues públicos)           |
