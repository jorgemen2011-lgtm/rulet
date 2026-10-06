# Convenciones

El orden de trabajo, las responsabilidades de cada capa y la checklist de revisión están en el
[manual de desarrollo](./development-guide.md). Aquí, las convenciones de forma.

## Nombres

| Qué                          | Convención                                                 | Ejemplo                                        |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Archivos TS (no componentes) | `kebab-case`                                               | `use-feature.ts`, `safe-redirect.ts`           |
| Componentes React            | `PascalCase.tsx` (+ `PascalCase.module.css` en web)        | `FavoriteList.tsx`                             |
| Archivos NestJS              | `<nombre>.<tipo>.ts`                                       | `favorites.controller.ts`, `jwt-auth.guard.ts` |
| Dominio (carpeta y ruta)     | `kebab-case`, plural                                       | `order-items` → `/v1/order-items`              |
| Entidad                      | `kebab-case`, singular                                     | `order-item` → `OrderItemSchema`               |
| Esquemas Zod                 | `PascalCase` + `Schema`                                    | `CreateFavoriteRequestSchema`                  |
| Tipos inferidos              | `PascalCase`                                               | `CreateFavoriteRequest`                        |
| Tablas y columnas            | `snake_case` (en TS, `camelCase`)                          | `user_id` ↔ `userId`                           |
| Clave en `FEATURES`          | `camelCase`                                                | `pushNotifications`                            |
| Paquetes internos            | `@rulet/<nombre>`                                          | `@rulet/shared`                                |
| Variables de entorno         | `SCREAMING_SNAKE_CASE`                                     | `CORS_ORIGINS`                                 |
| Tests                        | API: `*.spec.ts`, `test/*.e2e-spec.ts`; resto: `*.test.ts` | `users.service.spec.ts`, `csp.test.ts`         |

Los generadores (`pnpm gen`, ver [`turbo/generators/README.md`](../turbo/generators/README.md)) derivan todos estos
nombres del dominio y la entidad; úsalos para no equivocarte.

## Código

- **TypeScript 6** (`~6.0.0`) estricto en todo el repo. Nada de `any` sin justificar. No se sube a TypeScript 7
  mientras `typescript-eslint` no lo admita ([ADR 0010](./adr/0010-versiones-node24-esm.md)).
- **ESM en la API**: `apps/api` es `"type": "module"` con `module: nodenext`, así que los imports relativos
  llevan extensión **`.js`** aunque el archivo sea `.ts`:

  ```ts
  import { UsersService } from './users.service.js';
  ```

  En `packages/*` (compilan a CommonJS), web y móvil los imports relativos van sin extensión. Web usa el alias
  `@/` (`@/lib/api`); móvil, rutas relativas.

- **`process.env` solo en los módulos `env`**: `apps/api/src/config/env.ts` y `src/lib/env.ts` de web y móvil
  (además de `apps/api/src/database/migrate.ts`, los `*.config.*` y los tests). El resto del código usa el valor
  ya validado (`AppConfigService.get(...)` en la API, `env` en los clientes). Lo impide la regla ESLint
  `no-restricted-properties`.
- Formato con Prettier (comillas simples, _trailing commas_, ancho 110; se aplica al guardar en VS Code y en el
  hook `pre-commit`). No se discute en revisiones.
- Comentarios en español, concisos, que expliquen el porqué.
- Cada paquete expone su API pública en `src/index.ts`; cada feature de cliente, en `features/<feature>/index.ts`.
  Lo que no se exporta ahí es interno.
- Tests junto al código; e2e de la API en `apps/api/test`.
- Vitest 4 en todo el repo (en la API con `globals: true`).

## Commits — Conventional Commits

```
<tipo>(<ámbito>): <descripción en minúscula e imperativo>
```

Lo comprueba **commitlint** (`commitlint.config.mjs`, sobre `@commitlint/config-conventional`) en el hook
`commit-msg`. Un commit que no cumple se rechaza.

- **Tipos**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.
- **Ámbito obligatorio** (`scope-empty: never`), uno o varios separados por coma:

  | Ámbito          | Para                                                                 |
  | --------------- | -------------------------------------------------------------------- |
  | `api`           | `apps/api`                                                           |
  | `web`           | `apps/web`                                                           |
  | `mobile`        | `apps/mobile`                                                        |
  | `shared`        | `packages/shared`                                                    |
  | `api-client`    | `packages/api-client`                                                |
  | `design-tokens` | `packages/design-tokens`                                             |
  | `eslint-config` | `packages/eslint-config`                                             |
  | `repo`          | raíz, `turbo/generators`, `packages/tsconfig`, cambios transversales |
  | `deps`          | actualizaciones de dependencias (Dependabot usa `build(deps)`)       |
  | `ci`            | `.github/`                                                           |
  | `docs`          | `docs/` y READMEs                                                    |

- Cabecera de 100 caracteres como máximo; la descripción no empieza por mayúscula ni termina en punto. Cuerpo y pie
  con líneas de 100 caracteres como máximo. Cambio incompatible: `!` tras el ámbito (`feat(api)!: …`).

Ejemplos: `feat(mobile): añadir notificaciones push`, `fix(api): devolver 404 si el recurso no existe`,
`feat(web,mobile): añadir lista de favoritos`.

## Hooks de git

Husky los instala con `pnpm install` (script `prepare`: `husky || true`). En CI están desactivados (`HUSKY=0`).

| Hook         | Ejecuta                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `pre-commit` | `lint-staged` → `prettier --write --ignore-unknown` en los archivos preparados |
| `commit-msg` | `commitlint --edit "$1"`                                                       |

Los hooks no ejecutan lint, typecheck ni tests: eso lo hace `pnpm check` antes del PR. No se saltan con
`--no-verify`.

## Ramas y PRs

- `main` siempre desplegable. Se trabaja en ramas cortas `<tipo>/<tema>`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Todo entra por PR con CI en verde y la plantilla completada.
- Un PR que cambia un contrato incluye los cambios de API **y** clientes.
- Squash merge: el título del PR sigue Conventional Commits con las mismas reglas.

## Decisiones de arquitectura

Cualquier decisión que sea cara de revertir (base de datos, auth, una librería estructural, un cambio de reglas de
dependencia o de versiones mayores) se registra como ADR en `docs/adr/` antes o junto con el PR que la implementa.
