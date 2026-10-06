#!/usr/bin/env bash
# Preparación del Dev Container / Codespace. Es idempotente: se puede relanzar sin romper nada.
set -euo pipefail

cd "$(dirname "$0")/.."

# Solo el shim de pnpm: la imagen ya trae yarn global y `corepack enable` a secas chocaría con él.
sudo corepack enable pnpm
pnpm install --frozen-lockfile

# Nunca sobrescribe un .env existente: puede contener cambios locales del desarrollador.
copy_env() {
  if [ ! -f "$2" ]; then
    cp "$1" "$2"
    echo "Creado $2 a partir de $1"
  fi
}
copy_env apps/api/.env.example apps/api/.env
copy_env apps/web/.env.example apps/web/.env.local
copy_env apps/mobile/.env.example apps/mobile/.env

# BD de desarrollo (DATABASE_URL viene del entorno del contenedor). La de test (`rulet_test`) la migran
# los propios e2e al arrancar.
pnpm --filter @rulet/api db:migrate

echo "Listo. Arranca todo con: pnpm dev"
