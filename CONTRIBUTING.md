# Contribuir

1. Crea una rama desde `main`: `feat/<algo>`, `fix/<algo>` o `chore/<algo>`.
2. Si es una funcionalidad nueva, sigue [Añadir una funcionalidad](./docs/adding-a-feature.md).
3. Antes de abrir el PR:
   ```bash
   pnpm check
   ```
4. Abre el PR con un título en formato [Conventional Commits](./docs/conventions.md#commits--conventional-commits) y completa la plantilla.
5. Si tomas una decisión de arquitectura, añade un ADR en `docs/adr/`.

CI debe estar en verde para fusionar. Se fusiona con _squash_.
