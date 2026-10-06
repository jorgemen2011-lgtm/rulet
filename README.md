# Rulet

Monorepo con **pnpm workspaces** + **Turborepo**. El producto principal es la app móvil (React Native / Expo); la web y la API completan el sistema.

## Estructura

```
rulet/
├── apps/
│   ├── mobile/        # App móvil — React Native + Expo (expo-router)
│   │   ├── app/       # Pantallas (rutas)
│   │   └── src/
│   │       ├── features/   # Funcionalidades SOLO móvil
│   │       └── lib/        # Cliente API, utilidades nativas
│   ├── web/           # Web — Next.js (App Router)
│   │   └── src/
│   │       ├── app/        # Páginas (rutas)
│   │       ├── features/   # Funcionalidades SOLO web
│   │       └── lib/
│   └── api/           # Backend — NestJS (un módulo por dominio en src/)
└── packages/
    ├── shared/        # Tipos de dominio, constantes y catálogo de features por plataforma
    ├── api-client/    # Cliente HTTP tipado que usan web y mobile
    └── tsconfig/      # Configuraciones base de TypeScript
```

## Dónde va cada cosa

| Si el código…                                         | Va en                      |
| ----------------------------------------------------- | -------------------------- |
| Es UI o una funcionalidad que solo existe en móvil    | `apps/mobile/src/features` |
| Es UI o una funcionalidad que solo existe en web      | `apps/web/src/features`    |
| Son tipos, reglas de negocio o constantes comunes     | `packages/shared`          |
| Es una llamada a la API                               | `packages/api-client`      |
| Es lógica de servidor                                 | `apps/api/src/<dominio>`   |

Regla: `packages/*` nunca importa de `apps/*` ni de librerías de una sola plataforma (`react-native`, `next`, `@nestjs/*`).

### Funcionalidades por plataforma

`packages/shared/src/features.ts` declara qué funcionalidad está disponible en cada plataforma:

```ts
export const FEATURES = {
  auth: ['web', 'mobile'],
  pushNotifications: ['mobile'],
  adminPanel: ['web'],
};
```

Usa `isFeatureAvailable(feature, platform)` en las apps. El cliente API envía la cabecera `X-Client-Platform`, así la API puede saber desde qué plataforma llega cada petición.

## Puesta en marcha

Requisitos: Node 22+, pnpm 10+.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm dev:api      # http://localhost:3000
pnpm dev:web      # http://localhost:3001
pnpm dev:mobile   # Expo (escanea el QR con Expo Go)
pnpm dev          # todo a la vez
```

Otros comandos: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
