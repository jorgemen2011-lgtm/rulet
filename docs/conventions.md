# Convenciones

## Nombres

| Qué                          | Convención              | Ejemplo                                   |
| ---------------------------- | ----------------------- | ----------------------------------------- |
| Archivos TS (no componentes) | `kebab-case`            | `use-feature.ts`, `app-config.service.ts` |
| Componentes React            | `PascalCase.tsx`        | `FavoriteButton.tsx`                      |
| Archivos NestJS              | `<nombre>.<tipo>.ts`    | `favorites.controller.ts`                 |
| Esquemas Zod                 | `PascalCase` + `Schema` | `CreateFavoriteSchema`                    |
| Tipos inferidos              | `PascalCase`            | `CreateFavorite`                          |
| Paquetes internos            | `@rulet/<nombre>`       | `@rulet/shared`                           |
| Variables de entorno         | `SCREAMING_SNAKE_CASE`  | `CORS_ORIGINS`                            |

## Código

- TypeScript estricto en todo el repo. Nada de `any` sin justificar.
- Formato con Prettier (se aplica al guardar en VS Code). No se discute en revisiones.
- `process.env` solo se lee en el módulo `env` de cada app; el resto del código usa el valor ya validado.
- Cada paquete expone su API pública en `src/index.ts`. Lo que no se exporta ahí es interno.
- Tests junto al código (`*.spec.ts`); e2e de la API en `apps/api/test`.

## Commits — Conventional Commits

```
<tipo>(<ámbito>): <descripción en imperativo>
```

- **Tipos**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.
- **Ámbitos**: `api`, `web`, `mobile`, `shared`, `api-client`, `design-tokens`, `repo`.

Ejemplos: `feat(mobile): añadir notificaciones push`, `fix(api): devolver 404 si el recurso no existe`.

## Ramas y PRs

- `main` siempre desplegable. Se trabaja en ramas cortas: `feat/…`, `fix/…`, `chore/…`.
- Todo entra por PR con CI en verde y la plantilla completada.
- Un PR que cambia un contrato incluye los cambios de API **y** clientes.
- Squash merge: el título del PR sigue Conventional Commits.

## Decisiones de arquitectura

Cualquier decisión que sea cara de revertir (base de datos, auth, una librería estructural, un cambio de reglas de dependencia) se registra como ADR en `docs/adr/` antes o junto con el PR que la implementa.
