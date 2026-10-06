# 0009. Seguro por defecto y defensa en profundidad

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

La API, la web y la app móvil crecerán con funcionalidades que escribirán personas distintas, a menudo con
generadores (`pnpm gen`). Los fallos de seguridad más habituales en ese escenario son omisiones: una ruta que se
olvida de exigir autenticación, un cuerpo que acepta campos de más (`role`), una consulta que no filtra por
propietario, una variable de entorno de desarrollo que llega a producción, un `GET` que cambia estado. Revisar cada
PR a mano no escala ni es fiable.

## Decisión

**Lo seguro es lo que ocurre si no se hace nada; lo inseguro exige una excepción explícita, visible en el código y
revisable.** Y ningún control es el único: cada riesgo importante tiene al menos dos capas.

- **Guards globales** (`APP_GUARD` en `apps/api/src/app.module.ts`), en orden Throttler → Csrf → JwtAuth → Roles →
  Feature. Toda ruta exige access token salvo `@Public()`; `RolesGuard` deniega si falta el usuario;
  `@CurrentUser()` responde `401` en vez de devolver `undefined`.
- **Validación estricta**: toda entrada pasa por `ZodValidationPipe` con un `z.strictObject` de
  `packages/shared/src/contracts`; los campos desconocidos son `400`. Las salidas son proyecciones con lista
  blanca de campos.
- **Configuración fail-fast**: `apps/api/src/config/env.ts` valida el entorno al arrancar y, en producción, rechaza
  secretos de ejemplo, CORS abierto o con `localhost`, `TRUST_PROXY` sin definir y BD sin TLS. Las relajaciones
  son variables explícitas con nombre propio (`ALLOW_LOCALHOST_CORS`, `DATABASE_SSL_ALLOW_INSECURE`). Web y móvil
  validan sus variables públicas en build y al arrancar (https obligatorio fuera de desarrollo).
- **Valores restrictivos en la capa HTTP**: `Cache-Control: no-store`, límite de cuerpo de 100 kB, `helmet()`, CORS
  por lista exacta, errores sin detalles internos y logs sin parámetros SQL.
- **CSP estricta con nonce** en la web, sin `unsafe-inline` ni `unsafe-eval` en producción.
- **Reglas automatizadas** en lint y CI: `process.env` solo en los módulos de entorno, `dangerouslySetInnerHTML` y
  `eval` prohibidos, lockfile congelado, CodeQL, gitleaks, `pnpm audit`, Dependency Review y Trivy.
- **Generadores** que producen el patrón correcto: propietario desde el token, repositorio que filtra por
  `user_id`, `404` idéntico para lo ajeno y lo inexistente, contrato `strictObject`, listados con tope.

El detalle de cada control está en [`security.md`](../security.md).

## Alternativas consideradas

- **Guards por controlador (`@UseGuards` en cada clase)** — explícito, pero basta olvidarlo una vez para publicar
  una ruta abierta, y la revisión tiene que buscar una ausencia. Con guards globales lo que se revisa es la
  presencia de `@Public()`.
- **DTOs con `class-validator` y `whitelist`** — duplicaría los contratos que ya compartimos con los clientes
  ([ADR 0005](./0005-contratos-zod-compartidos.md)) y, con `whitelist` sin `forbidNonWhitelisted`, descarta en
  silencio los campos de más en vez de rechazar la petición.
- **Avisos en lugar de errores ante una configuración insegura** — un aviso en el log de arranque no impide que una
  configuración de desarrollo llegue a producción; un proceso que no arranca, sí.
- **Confiar en la revisión de código y en la plantilla de PR** — se mantiene como capa adicional, no como la única.

## Consecuencias

- Una ruta nueva sin `@Public()` responde `401` hasta que alguien la abre a propósito; los tests e2e deben
  autenticarse.
- Añadir un campo al cuerpo de un endpoint exige cambiar el contrato en `@rulet/shared`, y con él API y clientes
  en el mismo PR.
- Un error de configuración se descubre al desplegar (la API no arranca), no en producción con tráfico real. Cada
  variable nueva necesita su regla en `env.ts`, su `.env.example` y su entrada en
  [`environments.md`](../environments.md).
- La CSP con nonce obliga a renderizar la web bajo demanda (sin SSG, ISR ni caché de HTML en CDN) y prohíbe
  `style={{}}`.
- Los escapes existen y son peligrosos: `@Public()`, `ALLOW_LOCALHOST_CORS`, `DATABASE_SSL_ALLOW_INSECURE`, las
  desactivaciones de reglas de lint y las entradas de `pnpm.auditConfig.ignoreGhsas` deben justificarse en el PR y
  las aprueba un code owner.
- Los guards no sustituyen el filtrado por propietario: la autorización sobre recursos concretos sigue siendo
  responsabilidad de cada repositorio.
