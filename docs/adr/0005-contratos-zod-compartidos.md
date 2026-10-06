# 0005. Contratos HTTP compartidos con Zod

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

API y clientes deben estar de acuerdo en la forma de cada petición y respuesta. Duplicar tipos (DTOs en la API, interfaces en los clientes) provoca desincronizaciones silenciosas.

## Decisión

Cada contrato se define **una vez** como esquema **Zod** en `@rulet/shared/contracts`. La API valida con él (`ZodValidationPipe`), los clientes tipan y validan respuestas con él (`@rulet/api-client`). Los errores siguen el contrato común `ApiErrorResponse`.

## Alternativas consideradas

- **class-validator + DTOs de Nest** — no se pueden compartir con React Native sin arrastrar decoradores y `reflect-metadata`.
- **OpenAPI + generación de código** — añade un paso de generación; se puede añadir más tarde generando OpenAPI _desde_ Zod.

## Consecuencias

- Un cambio de contrato rompe la compilación en todos los sitios afectados.
- Validación en runtime en ambos extremos.
- Pendiente: generar documentación OpenAPI desde los esquemas.
