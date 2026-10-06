# Rulet

Producto **mobile-first**: app móvil en React Native (Expo), web en Next.js y API en NestJS, en un monorepo TypeScript con **pnpm** y **Turborepo**.

```
rulet/
├── apps/
│   ├── mobile/          📱 App principal — Expo · React Native · expo-router · EAS
│   ├── web/             🌐 Web — Next.js App Router
│   └── api/             ⚙️  API — NestJS · REST versionada (/v1)
├── packages/
│   ├── shared/          Contratos HTTP (Zod), dominio y catálogo de features por plataforma
│   ├── api-client/      Cliente HTTP tipado que comparten web y móvil
│   ├── design-tokens/   Colores, espaciado y tipografía comunes
│   ├── eslint-config/   Reglas de lint y de arquitectura
│   └── tsconfig/        Configuración base de TypeScript
└── docs/                Arquitectura, guías, convenciones y ADRs
```

## Principios

- **Una fuente de verdad por concepto**: los contratos de la API, las funcionalidades por plataforma y los tokens de diseño se definen una vez en `packages/` y se usan en todas partes.
- **Cada plataforma tiene su UI**: lo exclusivo de web o de móvil vive en `apps/<plataforma>/src/features`; lo común, en `packages/`.
- **La arquitectura se hace cumplir sola**: los límites entre paquetes y plataformas los comprueban `turbo boundaries` y ESLint en CI.
- **Fallar pronto**: variables de entorno y respuestas de la API se validan en runtime.

Lee la [arquitectura](./docs/architecture.md) para la visión completa.

## Puesta en marcha

Requisitos: Node 22 (`.nvmrc`) y pnpm 10 (`corepack enable`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm dev            # todo a la vez
pnpm dev:api        # http://localhost:3000  (GET /health)
pnpm dev:web        # http://localhost:3001
pnpm dev:mobile     # Expo: escanea el QR con Expo Go
```

## Comandos

| Comando           | Qué hace                                                        |
| ----------------- | --------------------------------------------------------------- |
| `pnpm check`      | Todo lo que comprueba CI: lint, tipos, tests, formato y límites |
| `pnpm build`      | Build de todos los paquetes y apps                              |
| `pnpm test`       | Tests unitarios                                                 |
| `pnpm test:e2e`   | Tests e2e de la API                                             |
| `pnpm lint`       | ESLint (incluye reglas de arquitectura)                         |
| `pnpm typecheck`  | TypeScript                                                      |
| `pnpm format`     | Formatea con Prettier                                           |
| `pnpm boundaries` | Verifica que ningún paquete dependa de una app                  |

Para un paquete concreto: `pnpm --filter @rulet/api <script>`.

## Documentación

| Documento                                              |                                                   |
| ------------------------------------------------------ | ------------------------------------------------- |
| [Arquitectura](./docs/architecture.md)                 | Capas, reglas de dependencia, flujo de peticiones |
| [Añadir una funcionalidad](./docs/adding-a-feature.md) | Del contrato a la UI, paso a paso                 |
| [Convenciones](./docs/conventions.md)                  | Nombres, commits, ramas, PRs                      |
| [Entornos y despliegue](./docs/environments.md)        | Variables, entornos, Docker, EAS, CI              |
| [Decisiones (ADR)](./docs/adr/README.md)               | Por qué está construido así                       |
| [Contribuir](./CONTRIBUTING.md)                        | Flujo de trabajo                                  |
