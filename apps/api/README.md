# @rulet/api

API REST en **NestJS 11**. Única puerta a los datos para web y móvil.

```bash
pnpm dev:api              # desde la raíz, con recarga
pnpm --filter @rulet/api test
pnpm --filter @rulet/api test:e2e
```

## Estructura

```
src/
├── main.ts              Arranque
├── app.setup.ts         helmet, CORS, versionado, logger, apagado ordenado (lo usan también los e2e)
├── app.module.ts        Composición: config, rate limit, filtros y guards globales, módulos
├── config/              env.ts (esquema Zod) + AppConfigService tipado
├── common/              Piezas transversales (filters, guards, pipes, middleware, decorators)
└── modules/<dominio>/   Un módulo por dominio
test/                    Tests e2e (supertest)
```

## Reglas

- Nuevos endpoints en `src/modules/<dominio>`; se publican en `/v1/<ruta>`.
- Valida la entrada con `ZodValidationPipe(<Schema>)` usando contratos de `@rulet/shared`.
- Lanza excepciones de Nest (`NotFoundException`…): `AllExceptionsFilter` las convierte en `ApiErrorResponse`.
- Restringe por plataforma con `@RequireFeature('<feature>')`.
- Lee configuración con `AppConfigService`, nunca con `process.env`.

## Endpoints operativos

| Ruta          | Uso                                            |
| ------------- | ---------------------------------------------- |
| `GET /health` | Sonda de salud (no versionada, sin rate limit) |

Despliegue: ver [docs/environments.md](../../docs/environments.md#api--contenedor).

En producción la API no arranca sin `TRUST_PROXY` (proxies delante de la API, o `false` si recibe tráfico
directo) ni `CORS_ORIGINS` explícitos, y rechaza los secretos JWT de ejemplo o de desarrollo y los parámetros
TLS en `DATABASE_URL`. Ver `.env.example`. Las migraciones se aplican con `node dist/database/migrate.js`.
