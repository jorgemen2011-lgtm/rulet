# Documentación de Rulet

Si eres nuevo, léela en este orden. Cada documento remite a los demás para el detalle en vez de repetirlo.

| #   | Documento                                         | Para qué                                                                                                     |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | [README del repositorio](../README.md)            | Qué es Rulet, requisitos y puesta en marcha con base de datos                                                |
| 2   | [Arquitectura](./architecture.md)                 | Visión global: piezas, reglas de dependencia, tubería de la API, anatomía de cada app, lo pendiente          |
| 3   | [Manual de desarrollo](./development-guide.md)    | **Obligatorio.** Entorno, orden de trabajo, responsabilidades por capa, patrones, tests y Definition of Done |
| 4   | [Seguridad](./security.md)                        | **Obligatorio.** Modelo de amenazas, autenticación, CSRF, CSP, secretos, checklists y riesgos residuales     |
| 5   | [Base de datos](./database.md)                    | PostgreSQL y Drizzle: esquema, migraciones, repositorios y operación                                         |
| 6   | [Añadir una funcionalidad](./adding-a-feature.md) | Ejemplo completo, del contrato a la UI en cada plataforma (con `pnpm gen`)                                   |
| 7   | [Convenciones](./conventions.md)                  | Nombres, carpetas, commits, hooks de git, ramas y PRs                                                        |
| 8   | [Entornos y despliegue](./environments.md)        | Variables de entorno de cada app, entornos y cómo se publica cada una                                        |
| 9   | [GitHub y despliegue](./github-and-deployment.md) | ¿Se puede levantar en GitHub? (Codespaces y CI sí, producción no), GHCR, proveedores, despliegue y ajustes   |
| 10  | [Decisiones (ADR)](./adr/README.md)               | Por qué la arquitectura es como es                                                                           |

Fuera de `docs/`:

| Documento                                                     | Para qué                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md)                       | Resumen del flujo de trabajo para abrir un PR               |
| [`SECURITY.md`](../SECURITY.md)                               | Cómo informar de una vulnerabilidad y versiones con soporte |
| [`turbo/generators/README.md`](../turbo/generators/README.md) | Generadores de código (`pnpm gen`)                          |

Cada app y paquete tiene además su propio `README.md` con lo específico de esa pieza:
[`apps/api`](../apps/api/README.md), [`apps/web`](../apps/web/README.md), [`apps/mobile`](../apps/mobile/README.md),
[`packages/shared`](../packages/shared/README.md), [`packages/api-client`](../packages/api-client/README.md),
[`packages/design-tokens`](../packages/design-tokens/README.md) y
[`packages/eslint-config`](../packages/eslint-config/README.md).

> Si el código y la documentación no coinciden, manda el código: corrige el documento en el mismo PR.
