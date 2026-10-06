# @rulet/eslint-config

Configuraciones ESLint 10 (flat config) del monorepo. Además de calidad, **hacen cumplir la arquitectura y reglas
básicas de seguridad**. Todas se ejecutan con `--max-warnings=0`, así que un aviso también rompe CI.

| Config    | Para          | Se construye sobre | Añade                                                                                            | Prohíbe importar                                                       |
| --------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `base`    | —             | —                  | `@eslint/js` + `typescript-eslint` recomendados, Prettier                                        | —                                                                      |
| `library` | `packages/*`  | `base`             | —                                                                                                | `react*`, `react-native*`, `expo*`, `next*`, `@nestjs/*`, `**/apps/**` |
| `react`   | `apps/mobile` | `base`             | `react-hooks`, globals de navegador, `dangerouslySetInnerHTML`                                   | `@nestjs/*`                                                            |
| `next`    | `apps/web`    | `react`            | `@next/eslint-plugin-next` (`recommended` + `core-web-vitals`)                                   | `@nestjs/*`                                                            |
| `nest`    | `apps/api`    | `base`             | Globals de Node; desactiva `consistent-type-imports` (Nest necesita imports de valor para la DI) | `react*`, `next*`, `expo*`                                             |

Todas prohíben importar rutas internas de otros paquetes (`@rulet/*/src/*`).

Uso en cada paquete (`eslint.config.mjs`):

```js
export { default } from '@rulet/eslint-config/library'; // o /react, /next, /nest
```

## Reglas de calidad comunes (`base`)

`@typescript-eslint/consistent-type-imports`, `@typescript-eslint/no-unused-vars` (se permite el prefijo `_`),
`no-console` (solo `warn` y `error`, como aviso) y `eqeqeq: smart`.

## Reglas de seguridad

| Regla                                              | Dónde       | Por qué                                                                                                             |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `no-eval`, `no-implied-eval`, `no-new-func`        | todas       | Ejecutar cadenas como código permite inyección de código.                                                           |
| `no-script-url`                                    | todas       | Las URLs `javascript:` son un vector de XSS.                                                                        |
| `no-restricted-properties` (`process.env`)         | todas       | La configuración se valida una vez en el módulo de entorno de cada app.                                             |
| `no-restricted-syntax` (`dangerouslySetInnerHTML`) | react, next | Insertar HTML sin escapar permite XSS. Detecta el atributo JSX y la clave en objetos de props (con o sin comillas). |

`process.env` solo se puede leer en `**/config/env.ts`, `**/lib/env.ts`, `**/database/migrate.ts`, los
`*.config.*` (ignorados) y los tests (`test/**`, `*.spec.ts`, `*.e2e-spec.ts`). Si una excepción puntual es
inevitable, desactiva la regla en esa línea con un comentario que explique el motivo; no la desactives para
el archivo entero.

Archivos ignorados en todas las configuraciones: `dist/`, `.next/`, `.expo/`, `node_modules/`, `*.config.*` y
`next-env.d.ts`.

El paquete se analiza a sí mismo con `pnpm --filter @rulet/eslint-config lint`. Contexto en
[Arquitectura](../../docs/architecture.md#reglas-de-dependencia) y [Seguridad](../../docs/security.md).
