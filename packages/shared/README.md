# @rulet/shared

Código **agnóstico de plataforma** que usan la API, la web y el móvil. No puede importar React, React Native, Expo, Next ni Nest (lo impide ESLint).

| Carpeta       | Contiene                                                       |
| ------------- | -------------------------------------------------------------- |
| `contracts/`  | Esquemas Zod de peticiones y respuestas, y sus tipos inferidos |
| `domain/`     | Tipos y reglas de negocio puras                                |
| `features/`   | `FEATURES`: en qué plataforma existe cada funcionalidad        |
| `platform.ts` | `Platform`, cabecera `x-client-platform`                       |

Web y móvil consumen el TypeScript fuente; Node (la API) usa el build CommonJS de `dist/` (`pnpm build`), mediante la condición `node` de `exports`.
