# Entornos y despliegue

## Entornos

| Entorno         | API                         | Web                         | Móvil (variante EAS)                |
| --------------- | --------------------------- | --------------------------- | ----------------------------------- |
| **development** | local `:3000`               | local `:3001`               | `development` · `com.rulet.app.dev` |
| **preview**     | despliegue por PR / staging | despliegue por PR / staging | `preview` · `com.rulet.app.preview` |
| **production**  | producción                  | producción                  | `production` · `com.rulet.app`      |

Las tres variantes móviles tienen bundle id distinto, así que pueden convivir instaladas en el mismo dispositivo.

## Variables de entorno

Cada app valida sus variables con Zod al arrancar o compilar. Los `.env.example` son la referencia; cópialos a `.env` (o `.env.local` en web). **Nunca se commitean secretos.**

### API (`apps/api/.env`) — validadas en `src/config/env.ts`

| Variable          | Por defecto             | Descripción                                    |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `NODE_ENV`        | `development`           | `development` · `test` · `production`          |
| `PORT`            | `3000`                  | Puerto HTTP                                    |
| `APP_VERSION`     | `0.0.0`                 | Versión expuesta en `/health` (inyectar en CI) |
| `CORS_ORIGINS`    | `http://localhost:3001` | Orígenes permitidos, separados por comas       |
| `THROTTLE_TTL_MS` | `60000`                 | Ventana del rate limit                         |
| `THROTTLE_LIMIT`  | `100`                   | Peticiones por ventana e IP                    |

### Web (`apps/web/.env.local`) — validadas en `src/lib/env.ts`

| Variable              | Descripción                                             |
| --------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Origen de la API, sin versión. Se incrusta en el build. |

### Móvil (`apps/mobile/.env`) — validadas en `src/lib/env.ts`

| Variable              | Descripción                                                   |
| --------------------- | ------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Origen de la API, sin versión. Se incrusta en el build.       |
| `APP_VARIANT`         | `development` · `preview` · `production` (lo fija `eas.json`) |

> Las variables `NEXT_PUBLIC_*` y `EXPO_PUBLIC_*` acaban en el bundle del cliente: son **públicas**. Nunca pongas secretos en ellas.

Al añadir una variable: actualiza el esquema, el `.env.example` y esta tabla. Si afecta al build, añádela a `env` en `turbo.json` para que la caché la tenga en cuenta (las `NEXT_PUBLIC_*` y `EXPO_PUBLIC_*` ya se detectan solas).

## Despliegue

### API — contenedor

```bash
docker build -f apps/api/Dockerfile -t rulet-api .
docker run -p 3000:3000 -e NODE_ENV=production -e CORS_ORIGINS=https://rulet.app rulet-api
```

La imagen ejecuta como usuario sin privilegios, solo incluye dependencias de producción y declara `HEALTHCHECK` contra `/health`. Sirve para cualquier plataforma de contenedores (Fly.io, Railway, Render, Cloud Run, ECS, Kubernetes). Configura el balanceador para:

- sonda de salud en `GET /health`;
- reenviar `x-request-id` si lo genera;
- enviar `SIGTERM` y esperar unos segundos antes de matar el proceso (apagado ordenado).

### Web — contenedor o Vercel

- **Contenedor**: `docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.rulet.app -t rulet-web .` (usa `output: 'standalone'`).
- **Vercel**: proyecto con _Root Directory_ `apps/web`; Vercel detecta Turborepo y pnpm automáticamente.

### Móvil — EAS

```bash
cd apps/mobile
npx eas build --profile preview       # build interno para testers
npx eas build --profile production    # build para tiendas
npx eas submit --profile production   # subir a App Store / Play
```

Los perfiles están en `apps/mobile/eas.json`. Los canales `preview` y `production` permiten publicar actualizaciones OTA con `eas update` sin pasar por tienda (solo JS; los cambios nativos requieren build nuevo).

### Local, como en producción

```bash
docker compose up --build   # API en :3000 y web en :3001
```

## CI

`.github/workflows/ci.yml`, en cada PR y en `main`:

1. Formato (`prettier --check`)
2. Límites entre paquetes (`turbo boundaries`)
3. Lint, typecheck, tests unitarios, tests e2e y build de todo (Turborepo, con caché)
4. Build de las imágenes Docker de API y web

Dependabot abre PRs semanales agrupados por ecosistema (Nest, Expo, Next, lint).
