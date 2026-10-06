# @rulet/web

Web en **Next.js 16 (App Router)** con React 19. Comparte con móvil contratos, cliente API y tokens de diseño, pero
tiene su propia UI y funcionalidades exclusivas (p. ej. `adminPanel` en `FEATURES`).

```bash
cp .env.example .env.local
pnpm dev:web                         # http://localhost:3001 (necesita la API en NEXT_PUBLIC_API_URL)
pnpm --filter @rulet/web test        # Vitest (entorno node)
```

| Script               | Comando                                               |
| -------------------- | ----------------------------------------------------- |
| `dev`                | `next dev -p 3001`                                    |
| `build` / `start`    | `next build` / `next start -p 3001`                   |
| `test`               | `vitest run --passWithNoTests`                        |
| `lint` / `typecheck` | ESLint (`@rulet/eslint-config/next`) / `tsc --noEmit` |

## Estructura

```
src/
├── proxy.ts                  Nonce por petición + Content-Security-Policy (Next 16 usa proxy.ts, no middleware.ts)
├── app/                      Rutas finas: / · /login · /register · /account · not-found; layout.tsx con AuthProvider
├── features/auth/            Sesión y formularios (ver abajo); se importa solo desde @/features/auth
├── components/               Button · TextField · Card · Alert · SiteHeader (CSS Modules, sin lógica de negocio)
├── hooks/use-feature.ts      useFeature('<feature>') según FEATURES de @rulet/shared
├── lib/
│   ├── env.ts                NEXT_PUBLIC_API_URL validada con Zod (falla el build si es inválida)
│   ├── api.ts                createApiClient({ platform: 'web' }) + subscribeSessionExpired
│   ├── safe-redirect.ts      safeRedirectPath: ?next= solo admite rutas internas
│   └── security/csp.ts       buildContentSecurityPolicy · createNonce (import 'server-only')
└── styles/globals.css        Variables CSS desde @rulet/design-tokens (sincronizadas a mano)
```

Convenciones de features: [`src/features/README.md`](./src/features/README.md).

## Variables de entorno

| Variable              | Notas                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Origen de la API sin versión (el cliente añade `/v1`). Por defecto `http://localhost:3000`. Se incrusta en el build: es **pública**. En producción debe ser `https://` salvo hacia `localhost`/`127.0.0.1`/`[::1]`. Sin credenciales, query ni fragmento. Se usa también en `connect-src` de la CSP |

Next solo expone al navegador las variables `NEXT_PUBLIC_*`; nunca pongas secretos en ellas.

## Autenticación

- La sesión vive en **cookies httpOnly emitidas por la API** (`credentials: 'include'`). El JavaScript de la página
  nunca ve los tokens: ni en memoria, ni en `localStorage`, ni en `sessionStorage`.
- `AuthProvider` (en `layout.tsx`) obtiene el usuario con `api.users.me()` y ofrece `login`, `register` y `logout`
  mediante `useAuth()`. Si la API rechaza la renovación (`subscribeSessionExpired`) y había sesión, redirige a
  `/login`.
- `RequireAuth` protege `/account` **solo como experiencia de usuario**; la protección real la hace la API.
- Tras el login, `?next=` pasa siempre por `safeRedirectPath`: solo rutas internas (evita open redirects).
- Las cookies pertenecen al host de la API, así que el servidor de Next no las recibe: **no** uses `src/lib/api.ts`
  desde Server Components ni desde `proxy.ts`.
- Web y API deben estar en el mismo _site_ (p. ej. `rulet.app` y `api.rulet.app`) para que se envíen las cookies
  `SameSite`, y `CORS_ORIGINS` de la API debe contener exactamente el origen de la web.

## Seguridad en el navegador

| Qué                 | Dónde                                     | Cómo                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSP con nonce       | `src/proxy.ts`, `src/lib/security/csp.ts` | `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src` con nonce en producción; `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`; `connect-src` limitado a la propia web y a la API |
| Cabeceras estáticas | `next.config.ts`                          | HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP; sin `x-powered-by`                                                                            |
| Lint                | `@rulet/eslint-config/next`               | Prohíbe `dangerouslySetInnerHTML`, `eval` y `process.env` fuera de `src/lib/env.ts`                                                                                                                         |

Consecuencias de la CSP con nonce:

- **Todo se renderiza bajo demanda**: `layout.tsx` hace `await connection()`. Sin SSG, ISR ni PPR, y el HTML no se
  puede cachear en una CDN (cada respuesta lleva su nonce).
- **Nada de `style={{…}}`**: en producción la CSP bloquea los atributos `style`. Usa CSS Modules.
- En desarrollo se relaja (`'unsafe-eval'` y `'unsafe-inline'` en estilos) para el overlay de Next.

Detalle en [Seguridad §4](../../docs/security.md#4-web).

## Tests

`vitest.config.ts` (entorno `node`, `src/**/*.test.ts`): `src/proxy.test.ts`, `src/lib/security/csp.test.ts` y
`src/lib/safe-redirect.test.ts`. No hay tests de componentes ni e2e de navegador: los flujos de login, registro,
cuenta y logout se prueban a mano.

## Producción

- `output: 'standalone'` para una imagen Docker mínima (`Dockerfile`, código propiedad de root, usuario `node`), o
  despliegue en Vercel. `NEXT_PUBLIC_API_URL` se pasa como `--build-arg`.
- Despliegue: [Entornos y despliegue](../../docs/environments.md) y
  [GitHub y despliegue](../../docs/github-and-deployment.md).

`AGENTS.md` y `CLAUDE.md` de esta carpeta los genera `next dev` (guía para agentes de Next); si se borran, vuelve a
crearlos.
