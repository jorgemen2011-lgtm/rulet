# Base de datos

PostgreSQL con **Drizzle ORM** (`drizzle-orm` 0.45 sobre `pg` 8) y **drizzle-kit** 0.31 para generar migraciones.
Por qué esta combinación: [ADR 0007](./adr/0007-postgresql-drizzle.md). Variables de conexión:
[Entornos y despliegue](./environments.md#api-appsapienv). Cómo se aplica en producción:
[GitHub y despliegue](./github-and-deployment.md).

## Contenido

1. [Dónde está cada cosa](#1-dónde-está-cada-cosa)
2. [Esquema y convenciones de nombres](#2-esquema-y-convenciones-de-nombres)
3. [Migraciones](#3-migraciones)
4. [Migraciones sin caída (expand/contract)](#4-migraciones-sin-caída-expandcontract)
5. [Transacciones y bloqueos](#5-transacciones-y-bloqueos)
6. [Conexión y TLS](#6-conexión-y-tls)
7. [Pool y timeouts](#7-pool-y-timeouts)
8. [Usuarios de BD con mínimo privilegio](#8-usuarios-de-bd-con-mínimo-privilegio)
9. [Copias de seguridad y restauración](#9-copias-de-seguridad-y-restauración)
10. [Limpieza de sesiones caducadas](#10-limpieza-de-sesiones-caducadas)
11. [BD de tests](#11-bd-de-tests)
12. [PostgreSQL en local](#12-postgresql-en-local)
13. [Limitaciones y trabajo pendiente](#13-limitaciones-y-trabajo-pendiente)

## 1. Dónde está cada cosa

| Pieza                        | Ruta                                                             | Qué hace                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Esquema                      | `apps/api/src/database/schema/<tabla>.ts`                        | Una tabla por archivo (`users.ts`, `sessions.ts`)                                                        |
| Índice del esquema           | `apps/api/src/database/schema/index.ts`                          | Reexporta todas las tablas; drizzle-kit lo lee para generar migraciones                                  |
| Módulo Nest                  | `apps/api/src/database/database.module.ts`                       | Global. Crea el `Pool`, expone el token `DATABASE` (instancia Drizzle tipada) y cierra el pool al apagar |
| Configuración de conexión    | `apps/api/src/database/pool-config.ts`                           | `createPoolConfig()`: TLS, tamaño del pool y timeouts. La usan la API y el migrador                      |
| Migrador de producción       | `apps/api/src/database/migrate.ts`                               | Compila a `dist/database/migrate.js`; aplica `apps/api/drizzle/` y termina                               |
| Migraciones (SQL versionado) | `apps/api/drizzle/NNNN_<nombre>.sql`                             | `0000_init.sql`, `0001_session_family_expiry.sql`                                                        |
| Metadatos de drizzle-kit     | `apps/api/drizzle/meta/`                                         | `_journal.json` (orden y marca de tiempo) y `NNNN_snapshot.json`. En `.prettierignore`                   |
| Configuración de drizzle-kit | `apps/api/drizzle.config.ts`                                     | `schema`, `out: './drizzle'`, `strict: true`; carga `apps/api/.env` si existe                            |
| Variables de BD              | `apps/api/src/config/env.ts`                                     | `DatabaseEnvSchema`, `checkDatabaseEnv()`, `validateDatabaseEnv()` (la del migrador)                     |
| Tests e2e                    | `apps/api/test/global-setup.ts`, `test-env.ts`, `support/app.ts` | Migran `rulet_test`, fijan la URL y vacían las tablas entre tests                                        |

Scripts de `apps/api/package.json` (ejecútalos con `pnpm --filter @rulet/api <script>`):

| Script        | Comando                | Uso                                                                                 |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `db:generate` | `drizzle-kit generate` | Compara el esquema con `drizzle/meta` y escribe el SQL nuevo. No se conecta a la BD |
| `db:migrate`  | `drizzle-kit migrate`  | Aplica las migraciones pendientes a `DATABASE_URL`. Solo desarrollo y CI            |
| `db:studio`   | `drizzle-kit studio`   | Explorador web de la BD de `DATABASE_URL`. Solo desarrollo                          |

Solo los **repositorios** (`<dominio>.repository.ts`) inyectan `DATABASE`: Controller → Service → Repository
([Manual de desarrollo § 2](./development-guide.md#2-responsabilidades-y-prohibiciones-por-capa)).

## 2. Esquema y convenciones de nombres

| Elemento                             | Convención                                                                               | Ejemplo real                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Tabla                                | `snake_case`, plural                                                                     | `users`, `sessions`                                                 |
| Columna                              | `snake_case` en BD, `camelCase` en TS, **nombre siempre explícito**                      | `userId: uuid('user_id')`                                           |
| Clave primaria                       | `uuid('id').primaryKey().defaultRandom()` (`gen_random_uuid()`)                          | `users.id`                                                          |
| Fechas                               | `timestamp(..., { withTimezone: true })` (`timestamptz`)                                 | `created_at`, `expires_at`                                          |
| Auditoría mínima                     | `created_at` `defaultNow()`; `updated_at` `defaultNow()` + `$onUpdate(() => new Date())` | `users.updated_at`                                                  |
| Índice                               | `<tabla>_<columnas>_idx`                                                                 | `sessions_user_id_idx`, plantilla: `<tabla>_user_id_created_at_idx` |
| Unique / FK (los genera drizzle-kit) | `<tabla>_<columna>_unique`, `<tabla>_<columna>_<tabla_ref>_<columna_ref>_fk`             | `users_email_unique`, `sessions_user_id_users_id_fk`                |
| Enum de PostgreSQL                   | `snake_case`, valores desde `@rulet/shared`                                              | `userRole = pgEnum('user_role', ROLES)`                             |
| Tipos TS de fila                     | `<Entidad>Row` (`$inferSelect`) y `New<Entidad>Row` (`$inferInsert`)                     | `UserRow`, `NewSessionRow`                                          |

Reglas:

- **Tablas de un usuario**: `user_id uuid not null` con FK a `users.id` `on delete cascade` e índice que empiece por
  `user_id`. Es lo que genera `pnpm gen api-module` (`turbo/generators/templates/api-module/schema.ts.tpl`), y el
  repositorio filtra siempre por `user_id`.
- **Unicidad en la BD**: una restricción `unique` (`users.email`), nunca un `SELECT` previo. El repositorio usa
  `onConflictDoNothing()` para no fallar con registros simultáneos (`UsersRepository.create`).
- **`$onUpdate` lo aplica Drizzle, no PostgreSQL**: un `UPDATE` escrito a mano en SQL no actualiza `updated_at`.
- **Enums del dominio**: añadir un valor a `ROLES` cambia `user_role` y obliga a generar una migración.
- Una tabla nueva se exporta en `schema/index.ts`; si no, drizzle-kit no la ve.

## 3. Migraciones

### Crear una

```bash
# 1. Edita apps/api/src/database/schema/<tabla>.ts (y schema/index.ts si es una tabla nueva)
pnpm --filter @rulet/api db:generate --name <descripcion_corta>   # → apps/api/drizzle/NNNN_<descripcion_corta>.sql
# 2. Revisa y, si hace falta, edita el SQL (ver la checklist)
pnpm --filter @rulet/api db:migrate                               # aplica a tu BD de desarrollo (apps/api/.env)
pnpm --filter @rulet/api test:e2e                                 # el global setup migra rulet_test
```

`db:generate` escribe tres cosas que van **en el mismo PR**: el `.sql`, el `meta/NNNN_snapshot.json` y la entrada
nueva en `meta/_journal.json`. Si drizzle-kit no puede decidir si una columna se ha renombrado o es nueva, pregunta
de forma interactiva: elige a conciencia (ver [§ 4](#4-migraciones-sin-caída-expandcontract)).

### Checklist de revisión del SQL

`/apps/api/src/database/` y `/apps/api/drizzle/` tienen revisor obligatorio en `.github/CODEOWNERS`.

- [ ] Es compatible con la versión de la API que está en producción (que sigue sirviendo mientras se migra).
- [ ] No añade una columna `NOT NULL` sin valor por defecto a una tabla con datos. Si hace falta, en tres pasos como
      `0001_session_family_expiry.sql`: columna nullable, `UPDATE` de relleno y `SET NOT NULL`.
- [ ] No borra ni renombra columnas o tablas que use el código desplegado.
- [ ] Ninguna sentencia tarda más de 15 s (ver `statement_timeout` en [§ 7](#7-pool-y-timeouts)).
- [ ] No usa `CREATE INDEX CONCURRENTLY` (no se puede ejecutar dentro de una transacción; ver abajo).
- [ ] Comentarios `--` que expliquen cualquier edición a mano.

### Reglas

- Una migración **ya fusionada no se edita ni se borra**: se escribe otra. El migrador guarda un hash de cada una en
  `drizzle.__drizzle_migrations`.
- **Conflictos entre ramas**: si al rebasar otra rama ya ha añadido una migración, borra la tuya (el `.sql`, su
  snapshot y su entrada en `_journal.json`), rebasa y vuelve a ejecutar `db:generate`. No renumeres a mano: el
  migrador decide qué aplicar comparando el campo `when` del journal con la última migración aplicada, y una
  migración con un `when` anterior a esa **se salta sin avisar** (`drizzle-orm/pg-core/dialect.js`, `migrate()`).
- No hay migraciones de bajada (`down`). Deshacer un cambio es una migración nueva hacia delante o, en último caso,
  restaurar una copia ([§ 9](#9-copias-de-seguridad-y-restauración)).

### Cómo se aplican

| Dónde                  | Comando                                                   | Conexión                                                        | Bloqueo                       |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| Desarrollo             | `pnpm --filter @rulet/api db:migrate`                     | `DATABASE_URL` tal cual (drizzle-kit no lee `DATABASE_SSL`)     | No                            |
| CI                     | `pnpm --filter @rulet/api db:migrate` con `NODE_ENV=test` | Servicio `postgres` de `ci.yml`, BD `rulet_test`                | No                            |
| Tests e2e              | `apps/api/test/global-setup.ts`                           | `TEST_DATABASE_URL` o `rulet_test` local                        | No                            |
| `docker compose` local | servicio `migrate` (`node dist/database/migrate.js`)      | `db:5432`, TLS desactivado (`DATABASE_SSL_ALLOW_INSECURE=true`) | `pg_advisory_lock`            |
| Producción             | `node dist/database/migrate.js` (misma imagen que la API) | `createPoolConfig()` (TLS de `DATABASE_SSL`)                    | `pg_advisory_lock(728391204)` |

En producción el migrador es **un paso previo y separado** del arranque de la API; la API nunca migra al arrancar.
Así varias réplicas no compiten por migrar y una migración fallida no tumba el servicio en marcha. `migrate.ts`:

1. Valida solo las variables de BD con `validateDatabaseEnv()` (no exige `JWT_ACCESS_SECRET` ni `CORS_ORIGINS`)
   con las mismas reglas de TLS que la API. **No carga ningún `.env`**: las variables deben estar en el entorno.
2. Abre un único `pg.Client` (no un pool), porque el bloqueo consultivo pertenece a la conexión.
3. Toma `pg_advisory_lock(728391204)`: dos migradores lanzados a la vez (despliegues solapados) se ejecutan en serie.
4. Aplica las pendientes con `drizzle-orm/node-postgres/migrator`. Drizzle ejecuta **todas las pendientes en una
   sola transacción**: si una falla, no se aplica ninguna.
5. Libera el bloqueo y termina. Si algo falla, registra solo `err.message` y sale con código `1`: el despliegue
   debe detenerse ahí y no arrancar la API nueva.

Consecuencias de que todo vaya en una transacción: `CREATE INDEX CONCURRENTLY` no funciona, y un valor añadido con
`ALTER TYPE ... ADD VALUE` no se puede usar en la misma migración ni en otra que se aplique en el mismo despliegue. Para un índice sobre una tabla grande, créalo antes a
mano fuera de la transacción y deja la migración idempotente:

```sql
-- A mano, antes del despliegue (no bloquea escrituras):
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_family_expires_at_idx" ON "sessions" ("family_expires_at");
-- En la migración (editada a mano: drizzle-kit genera CREATE INDEX sin IF NOT EXISTS):
CREATE INDEX IF NOT EXISTS "sessions_family_expires_at_idx" ON "sessions" USING btree ("family_expires_at");
```

## 4. Migraciones sin caída (expand/contract)

El orden de despliegue es **migrar → API → web** ([Entornos y despliegue](./environments.md#despliegue)). Mientras
se migra, y durante un despliegue gradual, la versión anterior de la API sigue atendiendo peticiones contra el
esquema nuevo. Además, una imagen anterior solo se puede recuperar (rollback) si el esquema sigue siendo compatible
con ella. Por eso todo cambio incompatible se hace en fases, cada una en su propio despliegue:

| Fase        | Esquema                                             | Código                                                 |
| ----------- | --------------------------------------------------- | ------------------------------------------------------ |
| 1. Expand   | Añade lo nuevo (columna nullable, tabla nueva)      | Escribe en lo viejo **y** en lo nuevo; lee de lo viejo |
| 2. Backfill | Rellena lo nuevo (`UPDATE`, por lotes si es grande) | Igual                                                  |
| 3. Switch   | (opcional) `SET NOT NULL`, índices, FK              | Lee de lo nuevo; deja de escribir en lo viejo          |
| 4. Contract | Borra lo viejo                                      | Ya no lo menciona ninguna versión desplegada           |

Ejemplo: renombrar `users.name` a `display_name` no es un `RENAME COLUMN` (la API desplegada fallaría en el acto),
sino: añadir `display_name` → escribir en ambas y rellenar → leer de `display_name` → borrar `name` en un PR
posterior. En el contrato HTTP la regla es la misma: la app móvil publicada sigue usando el contrato con el que se
compiló ([Manual de desarrollo, paso 2](./development-guide.md#paso-2--contrato-zod-en-ruletshared)).

| Operación                                          | ¿Segura en un paso?                    | Cómo hacerla                                                                                         |
| -------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Añadir tabla                                       | Sí                                     | —                                                                                                    |
| Añadir columna nullable, o con `DEFAULT` constante | Sí                                     | —                                                                                                    |
| Añadir columna `NOT NULL` sin default              | No                                     | Nullable → relleno → `SET NOT NULL` (como `0001_session_family_expiry.sql`)                          |
| Renombrar columna o tabla                          | No                                     | Expand/contract                                                                                      |
| Borrar columna o tabla                             | No                                     | Primero un despliegue que deje de usarla; después la migración que la borra                          |
| Cambiar el tipo de una columna                     | No                                     | Columna nueva + relleno + cambio de lecturas + borrado                                               |
| Añadir índice en tabla grande                      | No (bloquea escrituras)                | `CREATE INDEX CONCURRENTLY` a mano antes + `IF NOT EXISTS` en la migración ([§ 3](#cómo-se-aplican)) |
| Añadir FK o `CHECK` en tabla grande                | No (recorre la tabla con bloqueo)      | `ADD CONSTRAINT ... NOT VALID` y, en otra migración, `VALIDATE CONSTRAINT`                           |
| Añadir valor a un enum (`user_role`)               | Sí, si no se usa en la misma migración | `ALTER TYPE ... ADD VALUE`; el código que lo usa, después                                            |
| Quitar valor de un enum                            | No                                     | PostgreSQL no lo permite: tipo nuevo + migración de datos                                            |

Para que una migración no se quede esperando detrás de una transacción larga (y bloquee a todos los que llegan
detrás), puede empezar con `SET LOCAL lock_timeout = '5s';`. Si una sentencia necesita más de los 15 s de
`statement_timeout`, `SET LOCAL statement_timeout = '5min';` al principio de la migración la amplía solo para esa
transacción. Ninguna migración actual lo usa: es una recomendación, no una convención ya aplicada.

## 5. Transacciones y bloqueos

- Las transacciones se abren **dentro de un método del repositorio**: `this.db.transaction(async (tx) => { … })`.
  El service no ve `tx`. No hay patrón para transacciones que crucen módulos: si hace falta, ADR.
- La corrección ante concurrencia se apoya en la BD, no en lecturas previas: restricciones `unique` con
  `onConflictDoNothing()`, `UPDATE` condicionales con `returning()` y bloqueos consultivos.
- En el código de la API, solo bloqueos **de transacción** (`pg_advisory_xact_lock`), que se liberan solos al
  confirmar o deshacer. Un `pg_advisory_lock` de sesión en una conexión del pool quedaría retenido al devolverla.
- Cada espacio de bloqueos usa una constante fija y documentada. Las actuales:

| Constante               | Valor           | Forma                                                                                 | Dónde                                     |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| `MIGRATION_LOCK_KEY`    | `728_391_204`   | `pg_advisory_lock($1)` (una clave `bigint`, sesión)                                   | `src/database/migrate.ts`                 |
| `FAMILY_LOCK_NAMESPACE` | `1_384_022_117` | `pg_advisory_xact_lock(ns::int, hashtext(family_id))` (dos claves `int`, transacción) | `src/modules/auth/sessions.repository.ts` |

Las formas de una y de dos claves no se solapan entre sí. Un bloqueo nuevo usa la forma de dos claves con un
espacio (`namespace`) propio.

Ejemplo real, `SessionsRepository.rotate` (`apps/api/src/modules/auth/sessions.repository.ts`): revoca el refresh
token actual y crea su sucesor de forma atómica, y si dos peticiones rotan el mismo token a la vez solo una gana.

```ts
async rotate(currentId: string, next: NewSession): Promise<boolean> {
  return this.db.transaction(async (tx) => {
    await lockFamily(tx, next.familyId); // pg_advisory_xact_lock(FAMILY_LOCK_NAMESPACE, hashtext(family_id))
    const revoked = await tx
      .update(sessions)
      .set({ revokedAt: sql`now()`, replacedById: next.id })
      .where(and(eq(sessions.id, currentId), isNull(sessions.revokedAt))) // condicional: solo una gana
      .returning({ id: sessions.id });
    if (revoked.length === 0) return false; // el service lo trata como reutilización
    await tx.insert(sessions).values(next);
    return true;
  });
}
```

Por qué cada pieza:

- **`UPDATE` condicional** (`revoked_at IS NULL`): la segunda petición concurrente no revoca nada y recibe `false`.
- **Bloqueo por familia** y no `SELECT … FOR UPDATE`: las filas de una familia crecen con cada rotación, así que no
  hay una fila fija que bloquear. `revokeFamily` toma el mismo bloqueo: sin él, un `UPDATE` concurrente con una
  rotación aún sin confirmar no vería la sesión hija y esta sobreviviría a la revocación.
- **SQL parametrizado**: `` sql`…${valor}…` `` envía los valores como parámetros. Prohibido `sql.raw()` o concatenar
  datos externos ([Seguridad § 3](./security.md#base-de-datos)).

## 6. Conexión y TLS

`createPoolConfig()` (`src/database/pool-config.ts`) construye la configuración de `pg` para la API y el migrador:

```ts
ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
```

- **`DATABASE_SSL` es la única fuente de verdad.** Con `true`, la conexión va cifrada y se verifica el certificado
  del servidor y su nombre de host. No existe un modo "cifrar sin verificar".
- **Sin parámetros TLS en la URL.** `pg` aplica los de `DATABASE_URL` por encima de la opción `ssl` y podrían
  desactivar TLS en silencio, así que `checkDatabaseUrlTls()` (`env.ts`) rechaza al arrancar, en cualquier entorno:
  `ssl`, `sslnegotiation`, `uselibpqcompat`, cualquier `sslmode` distinto de `verify-full`, y `sslmode=verify-full`,
  `sslrootcert`, `sslcert` o `sslkey` si `DATABASE_SSL` no es `true`. Las URLs que dan los proveedores suelen traer
  `?sslmode=require`: **quítalo** y pon `DATABASE_SSL=true`.
- **En producción** (`NODE_ENV=production`) `DATABASE_SSL=true` es obligatorio, salvo `DATABASE_SSL_ALLOW_INSECURE=true`
  explícito, que solo usa el `docker-compose.yml` local (red privada de compose).
- **CA**: sin `ca` propia, Node verifica contra su almacén de CA raíz por defecto. Si el proveedor firma con una CA
  propia (habitual en RDS y Cloud SQL; compruébalo en su documentación), hay dos vías, ambas con el archivo montado
  en tiempo de ejecución (`.dockerignore` excluye `*.pem` y `*.crt` del build):
  - `DATABASE_SSL=true` y `?sslmode=verify-full&sslrootcert=/ruta/ca.pem` en la URL (lo admite la validación);
  - la variable estándar de Node `NODE_EXTRA_CA_CERTS=/ruta/ca.pem`, que añade la CA al almacén.

  No hay una variable propia tipo `DATABASE_SSL_CA` (trabajo pendiente).

- `drizzle-kit` (`db:migrate`, `db:studio`) solo lee `DATABASE_URL` y no conoce `DATABASE_SSL`: úsalo contra BD
  locales o de CI, nunca contra producción.

## 7. Pool y timeouts

| Parámetro                 | Valor                                         | Efecto                                                                           |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `max`                     | `DATABASE_POOL_MAX` (1–100, por defecto `10`) | Conexiones máximas **por instancia** de la API                                   |
| `connectionTimeoutMillis` | `5_000`                                       | Pedir una conexión falla a los 5 s si la BD no responde o el pool está agotado   |
| `idleTimeoutMillis`       | `30_000`                                      | Una conexión inactiva se cierra a los 30 s                                       |
| `statement_timeout`       | `15_000`                                      | PostgreSQL cancela cualquier sentencia que pase de 15 s (también en el migrador) |
| `application_name`        | `rulet-api`                                   | Identifica las conexiones en `pg_stat_activity` (API y migrador)                 |

- `pool.on('error')` registra los errores de conexiones inactivas (p. ej. reinicio de la BD) en lugar de tumbar el
  proceso, y `DatabaseModule.onApplicationShutdown()` cierra el pool en el apagado ordenado.
- `GET /health/ready` hace `select 1` con un límite de 2 s y responde `503` si la BD no contesta; `GET /health` no
  toca la BD.
- **Dimensionado**: réplicas × `DATABASE_POOL_MAX` + 1 (migrador) + conexiones de administración debe quedar por
  debajo de `max_connections` del servidor (o del límite del plan).
- **Poolers externos** (PgBouncer, el pooler del proveedor): el migrador debe conectar **directamente**, porque su
  `pg_advisory_lock` es de sesión y en modo _transaction_ no queda ligado a una conexión fija. `pg` envía
  `statement_timeout` como parámetro de arranque, y algunos poolers rechazan parámetros que no conocen: no se ha
  probado contra ninguno. Por defecto, usa la conexión directa también para la API.

## 8. Usuarios de BD con mínimo privilegio

El código no lo impone (en local, Dev Container y CI hay un único usuario `rulet`, superusuario de la imagen
`postgres`): es responsabilidad del despliegue. En producción, **dos roles**:

| Rol           | Lo usa                                    | Permisos                                                                                               |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `rulet_owner` | Paso de migración (`DATABASE_URL` propia) | Propietario de la BD y del esquema `public`: DDL                                                       |
| `rulet_app`   | API                                       | `CONNECT`, `USAGE` en `public` y `SELECT, INSERT, UPDATE, DELETE` en sus tablas; sin DDL ni `TRUNCATE` |

```sql
-- 1. Como el administrador que da el proveedor:
CREATE ROLE rulet_owner LOGIN PASSWORD '<generada>';
CREATE ROLE rulet_app LOGIN PASSWORD '<generada>';
-- Si el administrador no es superusuario y el siguiente paso falla: GRANT rulet_owner TO <administrador>;
CREATE DATABASE rulet OWNER rulet_owner;            -- o ALTER DATABASE rulet OWNER TO rulet_owner;
REVOKE ALL ON DATABASE rulet FROM PUBLIC;
GRANT CONNECT ON DATABASE rulet TO rulet_app;

-- 2. Conectado a la BD rulet como rulet_owner (el mismo rol que ejecuta las migraciones):
REVOKE CREATE ON SCHEMA public FROM PUBLIC;          -- ya es así por defecto en PostgreSQL 15 o superior
GRANT USAGE ON SCHEMA public TO rulet_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rulet_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rulet_app;
-- Para las tablas que ya existan:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rulet_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rulet_app;
```

- Los privilegios por defecto solo se aplican a los objetos que crea **el rol que los definió**: si alguna vez migra
  otro rol, repite los `GRANT … ON ALL TABLES`.
- `rulet_app` no necesita acceso al esquema `drizzle` (tabla `__drizzle_migrations`), que solo usa el migrador.
- Comprobación: como `rulet_app`, `CREATE TABLE x ();` debe fallar con `permission denied`, y
  `SELECT has_table_privilege('rulet_app', 'users', 'DELETE');` debe devolver `t`.
- Rotar una contraseña: [Seguridad § 7](./security.md#rotar-la-contraseña-de-la-bd).

## 9. Copias de seguridad y restauración

**Primero, las del proveedor**: activa las copias automáticas y la recuperación a un instante (PITR) de la BD
gestionada y fija la retención. Nada en este repositorio hace copias por sí mismo.

Copia lógica adicional (antes de una migración arriesgada, para llevar datos a otro entorno o como segunda copia).
Usa un `pg_dump` de la misma versión mayor que el servidor o superior. Las herramientas de libpq sí entienden
`sslmode` (la restricción de [§ 6](#6-conexión-y-tls) es solo para `DATABASE_URL` de la API); `sslrootcert=system`
(libpq 16 o superior) verifica contra las CA del sistema:

```bash
export OWNER_URL='postgres://rulet_owner:<pass>@<host>:5432/rulet?sslmode=verify-full&sslrootcert=system'
pg_dump --format=custom --no-owner --no-privileges --file="rulet-$(date +%F).dump" "$OWNER_URL"
```

- Vuelca **toda** la BD, incluido el esquema `drizzle`: sin `drizzle.__drizzle_migrations`, el migrador volvería a
  aplicar `0000_init.sql` sobre las tablas restauradas.
- El volcado contiene emails, hashes argon2 (`password_hash`) y hashes de refresh tokens (`token_hash`): guárdalo
  cifrado, con acceso restringido y retención definida. Nunca en el repositorio ni en un issue.

Restauración en una BD nueva (nunca encima de la de producción en uso):

```bash
# Con el administrador del proveedor (rulet_owner no tiene CREATEDB):
createdb --maintenance-db='postgres://<admin>:<pass>@<host>:5432/postgres?sslmode=verify-full&sslrootcert=system' \
  --owner=rulet_owner rulet_restore
pg_restore --no-owner --exit-on-error \
  --dbname='postgres://rulet_owner:<pass>@<host>:5432/rulet_restore?sslmode=verify-full&sslrootcert=system' \
  rulet-2026-10-06.dump
```

Después: repite los `GRANT` de [§ 8](#8-usuarios-de-bd-con-mínimo-privilegio) (con `--no-privileges` no se
restauran), ejecuta `node dist/database/migrate.js` contra la BD restaurada (aplica lo que falte) y apunta la API a
ella. Restaurar una copia antigua deja fuera las sesiones posteriores: esos usuarios tendrán que volver a iniciar
sesión.

En local (`docker-compose.yml` de la raíz):

```bash
docker compose exec -T db pg_dump -U rulet --format=custom rulet > local.dump
docker compose exec -T db pg_restore -U rulet --dbname=rulet --clean --if-exists --no-owner < local.dump
```

**Pendiente**: no hay copias lógicas programadas ni pruebas de restauración periódicas. Una copia que nunca se ha
restaurado no está probada.

## 10. Limpieza de sesiones caducadas

Cada login crea una familia de sesiones y cada refresh añade una fila (`sessions`). Nada las borra: la tabla crece
sin límite ([Seguridad § 9](./security.md#9-riesgos-residuales-y-trabajo-pendiente)). Mientras no exista un job,
la limpieza es manual:

```sql
-- Borra solo familias que ya superaron su caducidad absoluta (90 días desde el login,
-- MAX_SESSION_LIFETIME_SECONDS en auth.service.ts). Ninguna de sus filas puede volver a usarse.
DELETE FROM sessions WHERE family_expires_at < now();
```

- **No borres tokens revocados de una familia viva** (`revoked_at IS NOT NULL` sin más): si se reutilizase un token
  ya rotado, la API no lo encontraría y respondería `401` sin detectar la reutilización ni revocar la familia.
- Con muchas filas, por lotes, para no mantener bloqueos largos ni superar `statement_timeout`:

  ```sql
  DELETE FROM sessions
  WHERE id IN (SELECT id FROM sessions WHERE family_expires_at < now() LIMIT 10000);
  -- repetir mientras borre filas
  ```

- `family_expires_at` no tiene índice: la consulta recorre la tabla. Si crece, añade el índice con el procedimiento
  de [§ 3](#cómo-se-aplican).
- `rulet_app` tiene permiso de `DELETE`, así que el job puede usar el rol de la API.
- **Pendiente de automatizar**: programarlo (cron del proveedor, `pg_cron` si el proveedor lo ofrece, o una tarea en
  la API; `@nestjs/schedule` no está instalado).

## 11. BD de tests

| Pieza           | Comportamiento                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL             | `TEST_DATABASE_URL` o, si no existe, `postgres://rulet:rulet@localhost:5432/rulet_test` (`test/test-env.ts`)                                                     |
| Guardia         | `test/global-setup.ts` **se niega a ejecutar** si el nombre de la BD no termina en `_test`                                                                       |
| Migraciones     | El global setup aplica `apps/api/drizzle/` antes de empezar (sin bloqueo ni TLS)                                                                                 |
| Aislamiento     | `resetDatabase()` (`test/support/app.ts`) ejecuta `TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE`; `CASCADE` vacía también las tablas con FK a `users` |
| Paralelismo     | `fileParallelism: false` (`vitest.config.e2e.ts`): los e2e comparten BD y van en serie                                                                           |
| Tests unitarios | No se conectan: `DATABASE_URL` apunta a `unit_tests_do_not_connect` (el pool de `pg` es perezoso)                                                                |
| CI              | Servicio `postgres:17-alpine` con `rulet_test`; `db:migrate` y `test:e2e` con `NODE_ENV=test`                                                                    |

`TEST_DATABASE_URL` se pasa a Turborepo con `passThroughEnv` (`apps/api/turbo.json`). Una tabla nueva sin FK a
`users` hay que añadirla al `TRUNCATE` de `resetDatabase()`.

## 12. PostgreSQL en local

Se necesita PostgreSQL 13 o superior (`gen_random_uuid()` integrado); dev, CI y compose usan **17**. Los valores
por defecto (`apps/api/.env.example`, `test/test-env.ts`) esperan el usuario `rulet` con contraseña `rulet` y las BD
`rulet` y `rulet_test` en `localhost:5432`.

| Opción                                       | Credenciales      | `rulet_test`            | Comando                        |
| -------------------------------------------- | ----------------- | ----------------------- | ------------------------------ |
| **Dev Container / Codespaces** (recomendado) | `rulet` / `rulet` | Sí (`init-test-db.sql`) | Abrir el repo en el contenedor |
| `docker compose` de la raíz (servicio `db`)  | `rulet` / `rulet` | Sí (`init-test-db.sql`) | `docker compose up -d db`      |
| Instalación nativa                           | Las que crees     | Créala                  | Ver abajo                      |

**Dev Container**: `.devcontainer/docker-compose.yml` levanta `postgres:17-alpine` (volumen
`devcontainer-db-data`) y comparte red con el contenedor de trabajo, así que la BD está en `localhost:5432`.
`post-create.sh` aplica las migraciones a `rulet`. `init-test-db.sql` crea `rulet_test` **solo la primera vez**, con
el volumen vacío. Pasos completos: [GitHub y despliegue § 1](./github-and-deployment.md#1-codespaces-entorno-de-desarrollo-completo).

**`docker compose` de la raíz** (publica el puerto solo en `127.0.0.1`):

```bash
docker compose up -d db              # crea rulet y rulet_test (reutiliza .devcontainer/init-test-db.sql)
pnpm --filter @rulet/api db:migrate  # con el DATABASE_URL por defecto de apps/api/.env.example
```

**Instalación nativa** (p. ej. `brew install postgresql@17` en macOS o el paquete `postgresql` de tu distribución),
como superusuario (`psql -U postgres` o `sudo -u postgres psql`):

```sql
CREATE ROLE rulet LOGIN PASSWORD 'rulet';
CREATE DATABASE rulet OWNER rulet;
CREATE DATABASE rulet_test OWNER rulet;
```

```bash
pnpm --filter @rulet/api db:migrate   # usa DATABASE_URL de apps/api/.env
```

Estas credenciales son solo para tu máquina; nunca las reutilices en un entorno desplegado.

## 13. Limitaciones y trabajo pendiente

- Mínimo privilegio no impuesto por el código: depende del despliegue ([§ 8](#8-usuarios-de-bd-con-mínimo-privilegio)).
- Sin limpieza automática de `sessions` ([§ 10](#10-limpieza-de-sesiones-caducadas)) ni índice en
  `family_expires_at`.
- Sin copias lógicas programadas ni pruebas de restauración ([§ 9](#9-copias-de-seguridad-y-restauración)).
- Sin variable para una CA propia (`DATABASE_SSL_CA`): se usa `sslrootcert` en la URL o `NODE_EXTRA_CA_CERTS`.
- El migrador ejecuta todo en una transacción: sin `CREATE INDEX CONCURRENTLY` dentro de una migración, y
  `statement_timeout` de 15 s por sentencia salvo `SET LOCAL`.
- Sin migraciones de bajada.
- No se ha probado la API ni el migrador detrás de un pooler externo (PgBouncer o similar).
- `postgres:17-alpine` va por tag (no por digest) en `docker-compose.yml`, `.devcontainer/` y `ci.yml`.
