# Architecture Decision Records

Cada ADR documenta una decisión que es cara de revertir: el contexto, la decisión y sus consecuencias. Los ADR no se editan una vez aceptados; si una decisión cambia, se escribe uno nuevo que **sustituye** al anterior.

| #                                              | Decisión                                      | Estado   |
| ---------------------------------------------- | --------------------------------------------- | -------- |
| [0001](./0001-monorepo-pnpm-turborepo.md)      | Monorepo con pnpm workspaces y Turborepo      | Aceptada |
| [0002](./0002-expo-para-movil.md)              | Expo (React Native) para la app móvil         | Aceptada |
| [0003](./0003-nextjs-para-web.md)              | Next.js para la web, separada de la app móvil | Aceptada |
| [0004](./0004-nestjs-para-api.md)              | NestJS para la API                            | Aceptada |
| [0005](./0005-contratos-zod-compartidos.md)    | Contratos HTTP compartidos con Zod            | Aceptada |
| [0006](./0006-catalogo-features-plataforma.md) | Catálogo de funcionalidades por plataforma    | Aceptada |

Para una nueva: copia [`template.md`](./template.md) como `NNNN-titulo-corto.md`.
