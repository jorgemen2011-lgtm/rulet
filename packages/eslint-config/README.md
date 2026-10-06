# @rulet/eslint-config

Configuraciones ESLint (flat config) del monorepo. Además de calidad, **hacen cumplir la arquitectura**.

| Config    | Para          | Prohíbe importar                         |
| --------- | ------------- | ---------------------------------------- |
| `library` | `packages/*`  | react, react-native, expo, next, @nestjs |
| `react`   | `apps/mobile` | @nestjs                                  |
| `next`    | `apps/web`    | @nestjs                                  |
| `nest`    | `apps/api`    | react, next, expo                        |

Todas prohíben importar rutas internas de otros paquetes (`@rulet/*/src/*`).

## Reglas de seguridad

| Regla                                              | Dónde       | Por qué                                                                 |
| -------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `no-eval`, `no-implied-eval`, `no-new-func`        | todas       | Ejecutar cadenas como código permite inyección de código.               |
| `no-script-url`                                    | todas       | Las URLs `javascript:` son un vector de XSS.                            |
| `no-restricted-properties` (`process.env`)         | todas       | La configuración se valida una vez en el módulo de entorno de cada app. |
| `no-restricted-syntax` (`dangerouslySetInnerHTML`) | react, next | Insertar HTML sin escapar permite XSS.                                  |

`process.env` solo se puede leer en `**/config/env.ts`, `**/lib/env.ts`, `**/database/migrate.ts`, los
`*.config.*` (ignorados) y los tests (`test/**`, `*.spec.ts`, `*.e2e-spec.ts`). Si una excepción puntual es
inevitable, desactiva la regla en esa línea con un comentario que explique el motivo; no la desactives para
el archivo entero.

El paquete se analiza a sí mismo con `pnpm --filter @rulet/eslint-config lint`.
