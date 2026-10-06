# 0007. PostgreSQL y Drizzle ORM

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

La base de datos y el ORM figuraban como decisión abierta en [`architecture.md`](../architecture.md) ("PostgreSQL +
Prisma o Drizzle"). La autenticación ([0008](./0008-autenticacion-y-tokens.md)) ya necesita datos relacionales con
integridad: usuarios con email único, sesiones con FK a `users` en cascada, rotación de refresh tokens en una
transacción y serializada con bloqueos consultivos. Restricciones:

- La API es NestJS 12 en **ESM** sobre Node 24 ([0010](./0010-versiones-node24-esm.md)).
- La imagen de producción es `node:24-alpine` mínima (`pnpm deploy --prod`), sin herramientas de build.
- Los cambios de esquema deben poder revisarse en el PR como SQL: `/apps/api/drizzle/` tiene revisor obligatorio en
  `CODEOWNERS`, y las migraciones se aplican en un paso de despliegue separado mientras la versión anterior de la
  API sigue sirviendo.
- Los repositorios necesitan tipos de TypeScript para filas y consultas sin mantenerlos a mano.

## Decisión

**PostgreSQL** (17 en desarrollo, CI y `docker compose`) con **Drizzle ORM** (`drizzle-orm` 0.45 sobre el driver
`pg` 8, `drizzle-orm/node-postgres`) y **drizzle-kit** 0.31 para generar migraciones.

- El esquema se escribe en TypeScript en `apps/api/src/database/schema/`; los tipos de fila salen de él
  (`$inferSelect`, `$inferInsert`).
- `pnpm --filter @rulet/api db:generate` genera SQL versionado en `apps/api/drizzle/`, que se revisa (y se edita si
  hace falta) y se sube en el mismo PR.
- En producción las migraciones las aplica `node dist/database/migrate.js` (migrador de `drizzle-orm`) como paso
  previo, serializado con `pg_advisory_lock`; la API nunca migra al arrancar.
- Solo los repositorios usan Drizzle (token `DATABASE` de `DatabaseModule`).

Detalle operativo: [Base de datos](../database.md).

## Alternativas consideradas

- **Prisma** — esquema en un lenguaje propio (`schema.prisma`) y un paso de generación del cliente (`prisma generate`)
  que hay que encajar en Turborepo, Docker y CI. Su motor de consultas se ha distribuido históricamente como un
  binario nativo por plataforma (con variantes para Alpine/musl), una pieza más en la imagen y en la cadena de
  suministro. Los bloqueos consultivos necesitan SQL crudo con cualquiera de los dos, así que no marca diferencia.
- **TypeORM** — entidades con decoradores y metadatos en tiempo de ejecución; el tipado de los resultados de
  consultas es más débil (las relaciones y proyecciones no se infieren), y las migraciones generadas son clases
  TypeScript, no SQL que se revise tal cual.
- **MikroORM** — _unit of work_ e _identity map_: más abstracción de la que necesitan repositorios que hacen
  consultas concretas, y otro modelo mental (cambios que se vuelcan con `flush`) para la concurrencia que aquí se
  resuelve con `UPDATE` condicionales y bloqueos. Migraciones también en TypeScript.
- **`pg` a pelo o un query builder sin esquema (Kysely, Knex)** — control total del SQL, pero los tipos de las filas
  y las migraciones se mantienen a mano.

## Consecuencias

- **SQL revisable**: cada cambio de esquema llega al PR como un `.sql` legible; se puede editar (p. ej. el relleno en
  tres pasos de `0001_session_family_expiry.sql`).
- **Sin binarios ni generación de código**: `drizzle-orm` y `pg` son JavaScript; la imagen solo lleva `dist/`,
  `drizzle/` y dependencias de producción. `drizzle-kit` es solo de desarrollo.
- **ESM y tipos**: se importa como ESM sin adaptadores; las consultas del query builder están tipadas a partir del
  esquema y se parametrizan solas (`` sql`…${valor}…` `` también).
- **Obligatorio**: esquema en `src/database/schema/` y exportado en `index.ts`; migraciones solo con `db:generate` y
  revisadas; una migración fusionada no se edita; cambios incompatibles en fases expand/contract; nombres en
  `snake_case` explícitos.
- **Limitaciones aceptadas**:
  - Drizzle está en `0.x`: puede haber cambios incompatibles entre versiones menores (`^0.45.3` solo admite
    parches de la 0.45). Actualizar exige leer sus notas de versión.
  - El migrador no tiene migraciones de bajada, aplica todas las pendientes en **una** transacción (sin
    `CREATE INDEX CONCURRENTLY`) y ordena por la marca de tiempo del journal: una migración con marca anterior a la
    última aplicada se salta.
  - `drizzle-kit migrate` solo usa `DATABASE_URL` (no `DATABASE_SSL`): sirve para local y CI, no para producción.
  - El mínimo privilegio en la BD (roles separados para migrar y para la API) no lo impone el código; es
    responsabilidad del despliegue.
- Cambiar de ORM más adelante afecta solo a `src/database/` y a los `*.repository.ts`, porque los services y los
  controllers no conocen Drizzle.
