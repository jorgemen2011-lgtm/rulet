# 0006. Catálogo de funcionalidades por plataforma

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

Habrá funcionalidades solo de web, solo de móvil o de ambas. Sin un registro central, esa información queda dispersa en `if`s por el código y la API no sabe qué permitir a cada cliente.

## Decisión

`FEATURES` en `@rulet/shared` declara las plataformas de cada funcionalidad. Los clientes la consultan con `useFeature()`; la API con `@RequireFeature()` + `FeatureGuard`, usando la cabecera `x-client-platform`. El código propio de una plataforma vive en `apps/<plataforma>/src/features/`.

## Consecuencias

- Una única lista que responde "¿dónde existe esta funcionalidad?".
- La cabecera es informativa, no de seguridad: los permisos reales dependen del usuario autenticado.
- Si se necesita activar funcionalidades en caliente (por usuario, porcentaje…), este catálogo se puede respaldar con un servicio de feature flags sin cambiar su API.
