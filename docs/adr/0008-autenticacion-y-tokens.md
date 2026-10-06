# 0008. Autenticación propia con access JWT corto y refresh opaco rotado

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

Rulet tiene dos clientes con capacidades distintas: una web en el navegador (expuesta a XSS y CSRF) y una app
móvil con almacenamiento seguro del sistema. Ambos hablan con la misma API (`/v1`) y los usuarios y sus datos ya
viven en nuestra PostgreSQL. La autenticación figuraba como decisión abierta en
[`architecture.md`](../architecture.md) ("proveedor propio con JWT, o un servicio gestionado").

Restricciones:

- Una sola API para web y móvil, sin servidor intermedio obligatorio.
- Poder revocar sesiones (logout, robo) sin consultar la BD en cada petición.
- Que un XSS en la web no pueda llevarse credenciales reutilizables.
- Equipo pequeño: el mecanismo debe ser corto, auditable y probado con e2e contra PostgreSQL real.

## Decisión

**Autenticación propia en `apps/api/src/modules/auth`** con email y contraseña (argon2id) y dos tokens:

- **Access token**: JWT HS256 de 15 min (`ACCESS_TOKEN_TTL_SECONDS`), claims `sub`, `role`, `typ: 'access'`, con
  `iss`/`aud` verificados y algoritmo fijado. Se valida sin tocar la BD.
- **Refresh token**: opaco (32 bytes aleatorios), guardado en BD solo como SHA-256, válido 30 días
  (`REFRESH_TOKEN_TTL_SECONDS`) y nunca más de 90 días desde el login (`MAX_SESSION_LIFETIME_SECONDS`). Se
  **rota en cada uso** dentro de una familia; presentar uno ya rotado revoca la familia entera.

**El transporte depende de la plataforma** (`x-client-platform`):

- **Web**: cookies `HttpOnly` del host de la API (`__Host-rulet_at`, `SameSite=Lax`; `__Secure-rulet_rt`,
  `SameSite=Strict`, `Path=/v1/auth`). Los tokens nunca llegan al JavaScript de la página.
- **Móvil**: tokens en el cuerpo, guardados en SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) y enviados como
  `Authorization: Bearer`.

Los detalles y sus referencias al código están en [`security.md`](../security.md#2-comunicación-cliente--api).

## Alternativas consideradas

- **Proveedor gestionado (Auth0, Clerk, Cognito, Supabase Auth…)** — traería de serie verificación de email,
  recuperación de contraseña y MFA, que hoy no tenemos. Se descarta por ahora: añade coste por usuario activo,
  dependencia de un tercero en el camino crítico del login, una segunda fuente de verdad de los usuarios que hay
  que sincronizar con nuestra BD y una integración distinta en cada cliente. Reabrir si esas funcionalidades se
  vuelven prioritarias antes de poder construirlas.
- **Solo sesiones con estado (un id opaco consultado en BD en cada petición)** — revocación inmediata, pero una
  consulta por petición y sin forma de validar la identidad sin la BD. El access JWT de 15 min acota la ventana
  tras una revocación a cambio de no consultar la BD.
- **JWT de larga duración sin refresh** — imposible de revocar sin una lista negra, que reintroduce el estado.
- **Refresh token como JWT** — la revocación y la detección de reutilización exigen la BD igualmente; un token
  opaco hasheado no aporta información a quien lo robe ni a quien vuelque la tabla `sessions`.
- **Tokens en `localStorage` o en memoria en la web** — cualquier XSS los exfiltra y los usa desde otra máquina.
- **BFF (el servidor de Next guarda los tokens y hace de proxy hacia la API)** — es el patrón más aislado frente a
  XSS, pero duplica saltos y latencia, obliga a mantener un almacén de sesiones y secretos en la web, y hace que
  web y móvil usen la API de forma distinta. Con cookies httpOnly del host de la API, `SameSite`, CSP estricta con
  nonce y `CsrfGuard`, un XSS no puede leer los tokens; solo puede actuar mientras la página está abierta, igual
  que con un BFF. Reabrir si la web necesita llamar a la API desde el servidor con la sesión del usuario.

## Consecuencias

- **Mantenemos nosotros** todo lo que un proveedor daría hecho: verificación de email, recuperación y cambio de
  contraseña, MFA y "cerrar todas las sesiones" no existen todavía (ver
  [riesgos residuales](../security.md#9-riesgos-residuales-y-trabajo-pendiente)).
- Un access token sigue siendo válido hasta 15 min tras logout, revocación o cambio de rol. Rotar
  `JWT_ACCESS_SECRET` corta todos a la vez, pero no cierra sesiones.
- Los clientes deben renovar con **una sola petición a la vez** (single-flight en `@rulet/api-client`): dos
  refresh simultáneos con el mismo token se interpretan como robo y revocan la familia.
- **Web y API deben compartir site** (p. ej. `rulet.app` y `api.rulet.app`) para que viajen las cookies
  `SameSite`, y el servidor de Next no puede hacer llamadas autenticadas (las cookies son del host de la API).
- La cabecera `x-client-platform` es obligatoria en `/v1/auth/*`; no es un control de seguridad, pero fuerza
  preflight CORS.
- La tabla `sessions` crece con cada rotación y su limpieza aún no está automatizada.
- Cualquier cambio en `apps/api/src/modules/auth`, `apps/api/src/common` o los contratos requiere revisión de un
  code owner (`.github/CODEOWNERS`).
