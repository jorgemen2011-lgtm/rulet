# 0004. NestJS para la API

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

La API sirve a dos clientes y crecerá en dominios. Necesita una estructura que escale con el equipo y piezas transversales consistentes (validación, errores, seguridad).

## Decisión

**NestJS 11** sobre Express, organizado en un módulo por dominio (`src/modules/<dominio>`) y piezas transversales en `src/common`. Rutas versionadas por URI (`/v1`).

## Alternativas consideradas

- **Express/Fastify a pelo** — más flexible, pero cada equipo acaba inventando su estructura.
- **tRPC** — acopla más los clientes al servidor y no ofrece una API REST pública.

## Consecuencias

- Inyección de dependencias que facilita tests y sustituir infraestructura.
- Configuración, errores, rate limiting, request id y seguridad HTTP están resueltos una vez para todos los módulos.
