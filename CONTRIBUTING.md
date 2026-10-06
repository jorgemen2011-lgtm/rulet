# Contribuir

Todo el detalle está en el [manual de desarrollo](./docs/development-guide.md). Resumen:

1. **Entorno**: Node 24 (`.nvmrc`), pnpm 10 (`corepack enable pnpm`) y `pnpm install`, que instala los hooks de git.
   PostgreSQL con el Dev Container o según el [manual](./docs/development-guide.md#0-preparar-el-entorno).
2. **Rama** desde `main`: `feat/<tema>`, `fix/<tema>`, `chore/<tema>`, `docs/<tema>`.
3. **Funcionalidad nueva**: sigue el [orden obligatorio](./docs/development-guide.md#1-orden-obligatorio-de-trabajo)
   (FEATURES → contrato → tabla y migración → repository → service → controller → e2e → cliente → UI → docs).
   Empieza con `pnpm gen` ([generadores](./turbo/generators/README.md)); hay un ejemplo completo en
   [Añadir una funcionalidad](./docs/adding-a-feature.md).
4. **Seguro por defecto**: rutas privadas salvo `@Public()` justificado, propietario desde `@CurrentUser()`, toda
   entrada validada con Zod. Lee [Seguridad](./docs/security.md).
5. **Commits** en [Conventional Commits](./docs/conventions.md#commits--conventional-commits) con ámbito
   obligatorio (`feat(api): …`); commitlint los rechaza si no cumplen.
6. **Antes de abrir el PR**:
   ```bash
   pnpm check       # lint, typecheck, tests unitarios, formato y boundaries
   pnpm test:e2e    # si tocas la API (necesita PostgreSQL con rulet_test)
   ```
7. **PR** con título en Conventional Commits y la plantilla completa, incluida la sección de seguridad. Si tomas
   una decisión de arquitectura, añade un ADR en `docs/adr/`.

CI (`CI` y `Security`) debe estar en verde para fusionar. Se fusiona con _squash_.

Las vulnerabilidades **no** se informan en issues ni PRs públicos: sigue [`SECURITY.md`](./SECURITY.md).
