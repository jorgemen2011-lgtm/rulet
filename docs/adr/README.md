# Architecture Decision Records

Cada ADR documenta una decisión que es cara de revertir: el contexto, la decisión y sus consecuencias. Los ADR no se editan una vez aceptados; si una decisión cambia, se escribe uno nuevo que **sustituye** al anterior.

| #                                              | Decisión                                                         | Estado       |
| ---------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| [0001](./0001-monorepo-pnpm-turborepo.md)      | Monorepo con pnpm workspaces y Turborepo                         | Aceptada     |
| [0002](./0002-expo-para-movil.md)              | Expo (React Native) para la app móvil                            | Aceptada (¹) |
| [0003](./0003-nextjs-para-web.md)              | Next.js para la web, separada de la app móvil                    | Aceptada     |
| [0004](./0004-nestjs-para-api.md)              | NestJS para la API                                               | Aceptada (²) |
| [0005](./0005-contratos-zod-compartidos.md)    | Contratos HTTP compartidos con Zod                               | Aceptada     |
| [0006](./0006-catalogo-features-plataforma.md) | Catálogo de funcionalidades por plataforma                       | Aceptada     |
| [0007](./0007-postgresql-drizzle.md)           | PostgreSQL y Drizzle ORM                                         | Aceptada     |
| [0008](./0008-autenticacion-y-tokens.md)       | Autenticación propia con access JWT corto y refresh opaco rotado | Aceptada     |
| [0009](./0009-seguro-por-defecto.md)           | Seguro por defecto y defensa en profundidad                      | Aceptada     |
| [0010](./0010-versiones-node24-esm.md)         | Node 24 LTS, NestJS 12 en ESM y TypeScript 6                     | Aceptada     |

- (¹) Las actualizaciones OTA (`eas update`) que menciona como consecuencia no están configuradas: `expo-updates` no
  está instalado ([Entornos y despliegue](../environments.md#móvil--eas)).
- (²) La versión que cita (NestJS 11) la actualiza [0010](./0010-versiones-node24-esm.md) a NestJS 12 en ESM.

Para una nueva: copia [`template.md`](./template.md) como `NNNN-titulo-corto.md` con el siguiente número libre y
añádela a esta tabla en el mismo PR.
