# 0001. Monorepo con pnpm workspaces y Turborepo

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

El producto tiene tres aplicaciones (móvil, web, API) que comparten tipos, contratos y reglas de negocio. En repositorios separados, un cambio de contrato exige varios PRs coordinados y las versiones se desincronizan.

## Decisión

Un único repositorio con **pnpm workspaces** (`apps/*`, `packages/*`) y **Turborepo** como orquestador de tareas con caché. `node-linker=hoisted` por compatibilidad con Metro (React Native).

## Alternativas consideradas

- **Polyrepo** — duplicación de tipos y PRs coordinados entre repos.
- **Nx** — más potente pero más pesado y con más convenciones propias de las que necesitamos.
- **npm/yarn workspaces** — pnpm es más rápido y estricto con las dependencias.

## Consecuencias

- Un cambio de contrato y su uso en API, web y móvil van en el mismo PR.
- La caché de Turborepo hace CI y builds locales incrementales.
- Hay que vigilar los límites entre paquetes → automatizado con `turbo boundaries` y ESLint.
