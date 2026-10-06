# @rulet/design-tokens

Colores, espaciado, radios y tamaños de fuente comunes a web y móvil, como valores puros (números y strings), sin
depender de CSS ni de `StyleSheet`. Es agnóstico de plataforma (`@rulet/eslint-config/library`).

| Export      | Contenido                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `colors`    | `primary`, `primaryContrast`, `background`, `surface`, `text`, `textMuted`, `border`, `success`, `warning`, `danger` |
| `spacing`   | `xs` 4 · `sm` 8 · `md` 16 · `lg` 24 · `xl` 32 · `xxl` 48                                                             |
| `radii`     | `sm` 4 · `md` 8 · `lg` 16 · `full` 9999                                                                              |
| `fontSizes` | `xs` 12 · `sm` 14 · `md` 16 · `lg` 20 · `xl` 24 · `xxl` 32                                                           |
| `tokens`    | Los cuatro anteriores agrupados; tipo `Tokens`                                                                       |

Cada app los traduce a su sistema:

| App           | Dónde                    | Cómo                                                                                                                   |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile` | `src/theme/index.ts`     | Reexporta `colors`, `fontSizes`, `radii` y `spacing` para usarlos en `StyleSheet`                                      |
| `apps/web`    | `src/styles/globals.css` | Variables CSS (`--color-primary`, `--space-md`…) **escritas a mano**: si cambias un token, actualízalas en el mismo PR |

En web no se usan los tokens en `style={{…}}`: la CSP de producción bloquea los atributos `style` (ver
[`apps/web/README.md`](../../apps/web/README.md#seguridad-en-el-navegador)).

Scripts: `build` (`tsc -p tsconfig.build.json`), `typecheck`, `lint`. Sin tests propios.
