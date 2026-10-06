# @rulet/mobile

App principal en **React Native 0.86 + Expo SDK 57**, con `expo-router` y builds en **EAS**. Solo iOS y Android: no
soporta web (`expo-secure-store` no funciona allí; la web es `apps/web`).

```bash
cp .env.example .env
pnpm dev:mobile                      # expo start: Expo Go o development build
pnpm --filter @rulet/mobile android  # build nativo local (expo run:android)
pnpm --filter @rulet/mobile ios      # build nativo local (expo run:ios)
pnpm --filter @rulet/mobile test     # Vitest (lógica pura, entorno node)
```

## Estructura

```
src/
├── app/                      Rutas (expo-router). Finas: componen features.
│   ├── _layout.tsx           AppProviders + Stack.Protected (rutas protegidas por sesión)
│   ├── (auth)/               login · register — solo sin sesión
│   └── (app)/                index — solo con sesión
├── providers/                AppProviders · AuthProvider / useSession (estado de sesión de toda la app)
├── features/auth/            LoginForm · RegisterForm · SessionLoading · SignOutButton · hooks · validation · errors
├── components/               Screen · Button · TextField (UI sin lógica de negocio)
├── hooks/use-feature.ts      useFeature('<feature>') según FEATURES de @rulet/shared
├── lib/
│   ├── env.ts                Configuración pública validada (variante, apiUrl, allowInsecureHttp)
│   ├── env-config.ts         Lógica pura de env.ts (testeable): parseVariant, readApiUrl, devDefaultApiUrl
│   ├── api.ts                createApiClient({ platform: 'mobile', tokenStore: secureTokenStore }) + subscribeToSessionExpired
│   ├── secure-token-store.ts TokenStore sobre expo-secure-store
│   ├── first-launch.ts       clearSessionOnFirstLaunch: borra la sesión heredada tras reinstalar
│   └── install-marker.ts     Marca de instalación en el directorio de documentos (expo-file-system)
└── theme/                    Tokens de @rulet/design-tokens
app.config.ts                 Configuración dinámica por variante (APP_VARIANT)
eas.json                      Perfiles de build: development · preview · production
metro.config.js               Resolución de paquetes del monorepo
```

`ios/` y `android/` se generan (`expo prebuild`) y no se versionan.

## Sesión

- **Tokens en el almacén seguro del sistema**: `src/lib/secure-token-store.ts` guarda access y refresh token en
  Keychain (iOS) / Keystore (Android) con `expo-secure-store`, clave `rulet.auth.tokens` y
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no se sincronizan con iCloud ni se restauran en otro dispositivo). **Nunca
  AsyncStorage.** Si el contenido no cumple `AuthTokensSchema`, se borra.
- `@rulet/api-client` envía `Authorization: Bearer` y `credentials: 'omit'` (nunca cookies), renueva ante un `401` y
  guarda los tokens rotados directamente en el `TokenStore`.
- **Reinstalación**: en iOS el Keychain sobrevive a la desinstalación. En el primer arranque de cada instalación
  (`clearSessionOnFirstLaunch` + marca `.rulet-installed`) se borra cualquier sesión heredada.
- `android.allowBackup: false` en `app.config.ts`: los datos de la app no entran en copias de seguridad.
- `AuthProvider` (`src/providers/auth-provider.tsx`) restaura la sesión al arrancar y la **valida con
  `api.users.me()`**. Estados: `loading` (con `connectionError` si falló por red, 5xx o 429: se conservan los tokens
  y `retry()` reintenta), `authenticated` o `anonymous`.
- `logout()` nunca falla: el cliente borra los tokens del dispositivo aunque la API no responda (la sesión del
  servidor caduca sola en ese caso).

## Rutas protegidas

`src/app/_layout.tsx` monta cada grupo dentro de `Stack.Protected`:

| Grupo    | Pantallas           | Visible si                         |
| -------- | ------------------- | ---------------------------------- |
| `(app)`  | `index`             | `state.status === 'authenticated'` |
| `(auth)` | `login`, `register` | sin sesión                         |

Mientras `state.status === 'loading'` no se monta ninguna ruta (se muestra `SessionLoading`), así que nunca se ve
una pantalla protegida sin validar. Al cambiar la sesión (login, logout o expiración) expo-router saca al usuario de
las pantallas que ya no le corresponden. Ocultar pantallas es experiencia de usuario: la autorización la hace la API.

## Variantes y `EXPO_PUBLIC_API_URL`

| Variante (`APP_VARIANT`) | Bundle id               | Uso                   | `EXPO_PUBLIC_API_URL`                                     |
| ------------------------ | ----------------------- | --------------------- | --------------------------------------------------------- |
| `development`            | `com.rulet.app.dev`     | Desarrollo (ver nota) | Opcional. `http(s)`. Por defecto la API local (ver abajo) |
| `preview`                | `com.rulet.app.preview` | Testers internos      | **Obligatoria** y `https://`                              |
| `production`             | `com.rulet.app`         | Tiendas               | **Obligatoria** y `https://`                              |

- El perfil `development` de `eas.json` genera un _development build_ (`expo-dev-client`), útil cuando Expo Go no
  basta (módulos nativos propios). Para el día a día vale Expo Go (`pnpm dev:mobile`).
- `eas.json` fija `APP_VARIANT` en cada perfil. En EAS (`EAS_BUILD`) la variante es obligatoria y un valor
  desconocido hace fallar `app.config.ts`. En tiempo de ejecución, si falta la variante se aplican las reglas de
  `production`.
- `eas.json` **no** define `EXPO_PUBLIC_API_URL`: hay que configurarla para `preview` y `production` (variables de
  entorno de EAS o `env` del perfil). Sin ella, la app de esas variantes falla al arrancar a propósito;
  `app.config.ts` ya rechaza en build un valor que no sea `https://`.
- La variable se incrusta en el bundle: es **pública**.

API local en desarrollo (si no defines `EXPO_PUBLIC_API_URL`, `devDefaultApiUrl`):

| Dónde corre la app  | URL                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------- |
| Emulador de Android | `http://10.0.2.2:3000` (el emulador ve el equipo anfitrión en `10.0.2.2`)              |
| Simulador de iOS    | `http://localhost:3000`                                                                |
| Dispositivo físico  | Define `EXPO_PUBLIC_API_URL` con la IP de tu equipo, p. ej. `http://192.168.1.20:3000` |

`@rulet/api-client` solo admite `http://` hacia `localhost`, `127.0.0.1`, `[::1]` y `10.0.2.2`; para una IP de la red
local, `env.ts` activa `allowInsecureHttp` **solo** en la variante `development`.

## Tests

`vitest.config.ts` (entorno `node`): `src/features/auth/validation.test.ts`, `src/features/auth/errors.test.ts`,
`src/lib/env-config.test.ts`, `src/lib/first-launch.test.ts` y `app.config.test.ts`. Solo cubren lógica pura (nada
bajo `src/app`, que expo-router trataría como rutas). No hay tests de componentes ni e2e en dispositivo.

Despliegue: ver [Entornos y despliegue](../../docs/environments.md#móvil--eas). Seguridad en móvil:
[Seguridad §5](../../docs/security.md#5-móvil).
