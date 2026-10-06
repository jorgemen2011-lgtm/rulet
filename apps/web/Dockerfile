# syntax=docker/dockerfile:1
# Construir desde la raíz del monorepo:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.rulet.app -t rulet-web .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Las NEXT_PUBLIC_* se incrustan en el bundle durante el build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@rulet/web

FROM node:24-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
# Código propiedad de root y sin permisos de escritura para `node`: el proceso no puede modificar su propio
# código. Solo `.next/cache` (optimización de imágenes, ISR) es escribible.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p apps/web/.next/cache && chown -R node:node apps/web/.next/cache
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
