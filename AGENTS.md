<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Rulet — guía para agentes

Antes de cambiar nada lee el [manual de desarrollo](docs/development-guide.md) (orden de trabajo, capas,
patrones, tests y checklist). Para cambios estructurales, [`docs/architecture.md`](docs/architecture.md); para un
ejemplo completo, [`docs/adding-a-feature.md`](docs/adding-a-feature.md); para seguridad,
[`docs/security.md`](docs/security.md).

## Entorno

- Node 24 según `.nvmrc`. Si el `node` por defecto es otro, ponlo primero en el `PATH` antes de cualquier comando.
- pnpm 10. Versiones: TypeScript 6 (no 7), NestJS 12 en ESM, Next 16, Expo SDK 57, Vitest 4, ESLint 10
  ([ADR 0010](docs/adr/0010-versiones-node24-esm.md)). Antes de usar una API de Next, Expo, NestJS o Turborepo,
  consulta la documentación instalada en `node_modules` (p. ej. `node_modules/next/dist/docs/`).

## Orden de trabajo (obligatorio)

1. Plataformas en `FEATURES` (`packages/shared/src/features/index.ts`).
2. Contrato Zod en `packages/shared/src/contracts` (`pnpm --filter @rulet/shared build` después).
3. Tabla Drizzle en `apps/api/src/database/schema` + `pnpm --filter @rulet/api db:generate --name <nombre>`;
   revisa el SQL.
4. Repository (único con Drizzle).
5. Service con la lógica y sus tests unitarios.
6. Controller fino con guards/decoradores.
7. Tests e2e en `apps/api/test/<dominio>.e2e-spec.ts`.
8. Cliente: `api.request(...)` o un método en `@rulet/api-client`.
9. UI en `apps/<plataforma>/src/features/<feature>`; las rutas de `src/app` solo componen.
10. Docs y ADR.
11. Verificación (abajo) y PR.

Usa los generadores para el esqueleto y después adapta lo generado (el campo de ejemplo es `name`):
`pnpm gen feature --args <dominio> <entidad> <web,mobile>`, `pnpm gen contract|api-module --args <dominio> <entidad>`,
`pnpm gen client-feature --args <web|mobile> <dominio> <entidad>`. `turbo gen` sale con 0 aunque falle: comprueba
`>>> Success!`.

## Reglas que no se rompen

- `packages/*` no importa de `apps/*` ni librerías de una plataforma (react, react-native, expo, next, @nestjs).
- Los contratos HTTP se definen una vez en `packages/shared/src/contracts` y se usan en API y clientes.
- API: controller → service → repository. Solo el repository usa Drizzle (`DATABASE`); el controller no toca la BD.
- **Seguro por defecto**: ninguna ruta `@Public()` sin justificarlo; el propietario sale de `@CurrentUser()`, nunca
  del cliente; todas las consultas filtran por `user_id` y un recurso ajeno da 404; peticiones con
  `z.strictObject`; ids con `ParseUUIDPipe`; listados con `.limit()`; respuestas con lista blanca de campos.
- Errores: excepciones de Nest en la API (`ApiErrorResponse`); en clientes, `ApiError` traducido a mensajes fijos.
- Nunca registres contraseñas, tokens, cookies, `Authorization` ni parámetros SQL.
- `process.env` solo se lee en los módulos `env` (API: `src/config/env.ts`; web/móvil: `src/lib/env.ts`).
- En la API los imports relativos llevan `.js`.
- Componentes sin `fetch` ni `lib/api`; sin `dangerouslySetInnerHTML`; en web, sin `style={{…}}` (CSP).
- Migraciones: nunca edites una ya fusionada; la API no migra al arrancar.
- Decisiones caras de revertir → ADR en `docs/adr/`.

## Verificación

Un cambio no está terminado hasta que pasan:

```bash
pnpm check        # lint, typecheck, tests unitarios, formato y boundaries
pnpm test:e2e     # si tocas la API: PostgreSQL real con una BD *_test (TEST_DATABASE_URL o rulet_test por defecto)
pnpm build        # CI también compila
```

Commits en Conventional Commits con ámbito obligatorio (`commitlint.config.mjs`).
