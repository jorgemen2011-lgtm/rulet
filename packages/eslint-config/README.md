# @rulet/eslint-config

Configuraciones ESLint (flat config) del monorepo. Además de calidad, **hacen cumplir la arquitectura**.

| Config    | Para          | Prohíbe importar                         |
| --------- | ------------- | ---------------------------------------- |
| `library` | `packages/*`  | react, react-native, expo, next, @nestjs |
| `react`   | `apps/mobile` | @nestjs                                  |
| `next`    | `apps/web`    | @nestjs                                  |
| `nest`    | `apps/api`    | react, next, expo                        |

Todas prohíben importar rutas internas de otros paquetes (`@rulet/*/src/*`).
