# @rulet/api-client

Cliente HTTP tipado que comparten web y móvil. Cada respuesta se valida contra su contrato de `@rulet/shared`.

```ts
// Web: la sesión vive en cookies httpOnly; el cliente nunca ve los tokens.
const api = createApiClient({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  platform: 'web',
  onSessionExpired: () => router.replace('/login'),
});

// Móvil: los tokens se guardan en el almacén seguro del dispositivo (TokenStore propio, p. ej. expo-secure-store).
const api = createApiClient({
  baseUrl: env.EXPO_PUBLIC_API_URL,
  platform: 'mobile',
  tokenStore: secureTokenStore,
  onSessionExpired: () => router.replace('/login'),
});

const { user } = await api.auth.login({ email, password });
const me = await api.users.me();
const items = await api.request(ItemListSchema, '/items?page=2');
```

## API

| Método                            | Ruta                     | Notas                                                                   |
| --------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `auth.register(body)`             | `POST /v1/auth/register` | Devuelve `{ user }`. En móvil guarda los tokens en el `TokenStore`.     |
| `auth.login(body)`                | `POST /v1/auth/login`    | Igual que register. Un 401 aquí son credenciales inválidas: no renueva. |
| `auth.refresh()`                  | `POST /v1/auth/refresh`  | Single-flight: comparte la renovación en curso.                         |
| `auth.logout()`                   | `POST /v1/auth/logout`   | Limpia el `TokenStore` siempre; si la red falla, relanza el error.      |
| `users.me()`                      | `GET /v1/users/me`       | Autenticada.                                                            |
| `health()`                        | `GET /health`            | Pública, fuera del versionado.                                          |
| `request(schema, path, options?)` | `/<version><path>`       | Autenticada por defecto; `auth: false` para rutas públicas.             |

## Seguridad

- **Transporte por plataforma**: web usa `credentials: 'include'` y nunca envía `Authorization`; móvil envía
  `Authorization: Bearer` desde el `TokenStore` y `credentials: 'omit'` (nunca cookies).
- **Solo HTTPS**: `http://` se rechaza al construir el cliente salvo para `localhost`, `127.0.0.1`, `[::1]` y
  `10.0.2.2` (emulador Android), o con `allowInsecureHttp: true` explícito. También se rechazan credenciales
  embebidas en `baseUrl`.
- **Rutas relativas**: `request` rechaza rutas absolutas, `//host`, `..`, `\` o `#`, para que la sesión no
  viaje nunca a otro destino. Las redirecciones no se siguen (`redirect: 'error'`).
- **Cabeceras gestionadas**: `authorization`, `cookie` y `x-client-platform` las pone el cliente; las que pase el
  llamante con esos nombres se ignoran.
- **Timeout** por intento (15 s por defecto, `timeoutMs`), incluida la lectura del cuerpo.
- Las respuestas de auth nunca devuelven tokens al llamante: se guardan directamente en el `TokenStore`.

## Renovación de sesión

Ante un `401` en una ruta autenticada:

1. Si otra petición ya renovó la sesión mientras esta estaba en vuelo, se reintenta directamente.
2. Si no, se lanza **un único** refresh compartido por todas las peticiones que lo necesiten (single-flight). Es
   imprescindible: la API rota el refresh token y, si recibe dos veces el mismo, revoca toda la familia de sesiones.
3. Se reintenta la petición **una sola vez**.
4. Si la API **rechaza** el refresh (`401`/`403`): se limpia el `TokenStore`, se llama a `onSessionExpired()` una
   vez y la petición original falla con su `ApiError` 401 (con el error del refresh en `cause`).
5. Si el refresh falla por un problema **transitorio** (red, timeout, 5xx, 429) la sesión **no** se cierra: se
   propaga el error para que la app reintente más tarde.

En móvil, si no hay tokens guardados, un 401 es definitivo (no hay nada que renovar ni sesión que expirar). En web
el cliente no puede saber si hay sesión, así que un visitante anónimo que llame a `users.me()` provoca un refresh
fallido y `onSessionExpired()`.

## Errores

Todo fallo al hablar con la API es un `ApiError` con `status`, `body` (`ApiErrorResponse` o `null`) y `code`:

| `code`             | `status` | Cuándo                                             |
| ------------------ | -------- | -------------------------------------------------- |
| `http`             | 4xx/5xx  | La API respondió con error.                        |
| `network`          | `0`      | Sin respuesta (offline, DNS, TLS, CORS).           |
| `timeout`          | `0`      | Superado `timeoutMs`.                              |
| `aborted`          | `0`      | El llamante abortó con su `signal`.                |
| `invalid_response` | real     | La respuesta no cumple el contrato (o no es JSON). |
| `no_session`       | `0`      | `auth.refresh()` en móvil sin tokens guardados.    |

`error.isNetworkError` (red o timeout) y `error.isUnauthorized` ayudan a decidir qué mostrar. Los errores de uso
(configuración o ruta inválidas) son `Error` normales: son fallos de programación.

## Tests

```sh
pnpm --filter @rulet/api-client test
```

`fetch` se simula en `src/client.test.ts`; cubren transporte web/móvil, single-flight, expiración de sesión,
timeout, rechazo de `http://`, logout sin red y validación de respuestas.
