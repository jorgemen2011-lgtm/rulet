# syntax=docker/dockerfile:1
# Construir desde la raíz del monorepo:  docker build -f apps/api/Dockerfile -t rulet-api .
#
# La misma imagen sirve para los dos pasos del despliegue:
#   1. Migraciones (paso previo, una sola vez):  docker run --rm --env-file … rulet-api node dist/database/migrate.js
#   2. API (n réplicas):                          docker run --env-file … rulet-api
# La API nunca migra al arrancar.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# --- Dependencias y build ---
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@rulet/api
# Paquete autocontenido solo con dependencias de producción. Copia lo declarado en "files"
# de package.json: `dist/` (incluye el migrador) y `drizzle/` (migraciones SQL).
RUN pnpm deploy --filter=@rulet/api --prod --legacy /out

# --- Imagen final mínima ---
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Propiedad de root y sin permisos de escritura para `node`: el proceso no puede modificar su propio código.
COPY --from=build /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1
CMD ["node", "dist/main.js"]
