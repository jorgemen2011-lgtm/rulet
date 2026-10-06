# @rulet/mobile

App principal en **React Native + Expo**, con `expo-router` y builds en **EAS**.

```bash
pnpm dev:mobile                      # Expo Go / dev client
pnpm --filter @rulet/mobile android  # build nativo local
```

## Estructura

```
src/
├── app/          Rutas (expo-router). Finas: componen features.
├── features/     Funcionalidades de móvil (una carpeta cada una)
├── components/   UI reutilizable sin lógica de negocio
├── hooks/        useFeature…
├── providers/    Providers globales
├── lib/          env.ts (validado), api.ts (cliente)
└── theme/        Tokens de @rulet/design-tokens
app.config.ts     Configuración dinámica por variante (APP_VARIANT)
eas.json          Perfiles de build: development · preview · production
metro.config.js   Resolución de paquetes del monorepo
```

## Variantes

| Variante      | Bundle id               | Uso                       |
| ------------- | ----------------------- | ------------------------- |
| `development` | `com.rulet.app.dev`     | Dev client con depuración |
| `preview`     | `com.rulet.app.preview` | Testers internos          |
| `production`  | `com.rulet.app`         | Tiendas                   |

`ios/` y `android/` se generan (`expo prebuild`) y no se versionan.

Despliegue: ver [docs/environments.md](../../docs/environments.md#móvil--eas).
