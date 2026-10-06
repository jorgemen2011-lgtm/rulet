# 0010. Node 24 LTS, NestJS 12 en ESM y TypeScript 6

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

El monorepo se creó sobre Node 22, NestJS 11 (CommonJS, Jest 29), Next 15, Expo SDK 54, TypeScript 5.8 y ESLint 9
con `eslint-plugin-react`. Para empezar el desarrollo de producto sobre versiones con soporte largo había que
actualizar todo a la vez (commit `build(repo): actualizar a Node 24, Next 16, NestJS 12, Expo SDK 57 y
TypeScript 6`). Restricciones:

- NestJS 12 se distribuye solo como ESM.
- TypeScript 7 no es compatible con las herramientas que usamos: `typescript-eslint` 8.71 declara
  `"typescript": ">=4.8.4 <6.1.0"` como peer dependency.
- `eslint-plugin-react` no soportaba ESLint 10 en el momento de la actualización (motivo recogido en el mensaje del
  commit `1fa5bd5`; el paquete ya no está instalado y no se ha vuelto a comprobar).
- Expo fija las versiones de React y React Native de cada SDK; web y móvil deben compartir la misma versión de
  React para que `packages/*` funcione igual en las dos.

## Decisión

| Pieza      | Versión                                        | Cómo se fija                                                                                                         |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Node       | 24 LTS                                         | `.nvmrc` (`24`), `engines.node: ">=24"`, `node:24-alpine` (por digest) en Docker, CI con `node-version-file: .nvmrc` |
| TypeScript | 6.0 (`~6.0.0`)                                 | `devDependencies` de la raíz y de cada paquete                                                                       |
| NestJS     | 12 en **ESM**                                  | `apps/api/package.json` con `"type": "module"`; `module`/`moduleResolution: nodenext`                                |
| Tests      | Vitest 4 en todo el repo                       | API, web, móvil, `@rulet/api-client` y `turbo/generators`; sin Jest                                                  |
| ESLint     | 10, flat config, **sin** `eslint-plugin-react` | `@rulet/eslint-config`: `typescript-eslint`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`                 |
| Next.js    | 16                                             | `apps/web`; `src/proxy.ts` en lugar de `middleware.ts`                                                               |
| Expo       | SDK 57 (React Native 0.86, React 19.2)         | `apps/mobile`; expo-router 57                                                                                        |

Consecuencias concretas en el código:

- **API (ESM)**: los imports relativos llevan extensión `.js` (`import { AppModule } from './app.module.js'`),
  `main.ts` usa _top-level await_ y los scripts usan `import.meta` (p. ej. `test/global-setup.ts`).
- **Paquetes compartidos**: siguen compilando a CommonJS (`packages/*` sin `"type": "module"`), con imports
  relativos sin extensión. La API los importa desde `dist` gracias a la interoperabilidad ESM → CJS de Node.
- **TypeScript 6**: `module`/`moduleResolution` `nodenext` en la API y en los builds de `packages/*`, y `types`
  explícitos (`"types": ["vitest/globals", "node"]` en `apps/api/tsconfig.json`).
- **Next 16**: la convención `middleware` está obsoleta y renombrada a `proxy`. La documentación de la versión
  instalada está en `node_modules/next/dist/docs/` y `next dev` mantiene un bloque de guía en
  `apps/web/AGENTS.md`.

## Alternativas consideradas

- **Quedarse en NestJS 11 (CommonJS) y Jest** — evita migrar a ESM, pero deja la API en una versión que dejará de
  recibir correcciones y obliga a mantener Jest solo para la API.
- **TypeScript 7** — no lo admite `typescript-eslint` (peer `<6.1.0`); perderíamos el lint con tipos.
- **Mantener `eslint-plugin-react` con ESLint 9** — conserva sus reglas, pero bloquea ESLint 10. Las reglas de hooks
  siguen con `eslint-plugin-react-hooks` y el riesgo principal (`dangerouslySetInnerHTML`) se cubre con
  `no-restricted-syntax`.
- **Pasar también `packages/*` a ESM** — innecesario hoy: Metro, Next y la API consumen bien CommonJS, y cambiarlo
  afecta a los tres consumidores a la vez.

## Consecuencias

- Toda la cadena (local con `.nvmrc`, Dev Container `typescript-node:4-24-bookworm`, CI y Docker) usa Node 24.
- Código nuevo de la API: imports relativos con `.js` siempre. Los generadores (`turbo/generators/templates`) ya lo
  hacen.
- No se actualiza a TypeScript 7 hasta que `typescript-eslint` lo admita. `.github/dependabot.yml` no tiene una
  regla `ignore` para `typescript`: si Dependabot propone la 7, se cierra el PR (o se añade esa regla).
- Se pierden las reglas de `eslint-plugin-react` (p. ej. `jsx-key`); TypeScript y React cubren parte en tiempo de
  compilación y ejecución.
- La guía de versiones de 0004 (que cita NestJS 11) queda actualizada por este ADR; la decisión de usar NestJS no
  cambia.
- Antes de usar una API de Next 16, Expo 57, NestJS 12 o Turborepo, consulta la documentación instalada en
  `node_modules`: puede diferir de la conocida.
