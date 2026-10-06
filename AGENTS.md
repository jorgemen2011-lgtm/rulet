<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Rulet — guía para agentes

Lee `docs/architecture.md` antes de cambios estructurales y `docs/adding-a-feature.md` antes de añadir una funcionalidad.

## Reglas que no se rompen

- `packages/*` no importa de `apps/*` ni librerías de una plataforma (react, react-native, expo, next, @nestjs).
- Los contratos HTTP se definen una vez como esquemas Zod en `packages/shared/src/contracts` y se usan en API y clientes.
- Toda funcionalidad nueva se registra en `FEATURES` (`packages/shared/src/features`) con sus plataformas.
- Código exclusivo de una plataforma: `apps/<plataforma>/src/features/<feature>`.
- `process.env` solo se lee en los módulos `env` (API: `src/config/env.ts`; web/móvil: `src/lib/env.ts`).
- Decisiones caras de revertir → ADR en `docs/adr/`.

## Verificación

Antes de dar un cambio por terminado: `pnpm check` (lint, typecheck, tests, formato, boundaries) y, si tocas la API, `pnpm test:e2e`.
