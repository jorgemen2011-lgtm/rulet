# Features (web)

Una carpeta por funcionalidad; solo lo que existe en web o tiene UI propia de web.

```
features/<feature>/
  components/   UI de la feature (Client Components con 'use client' cuando usan estado o hooks)
  hooks/        estado y llamadas a la API (usan src/lib/api)
  lib/          utilidades puras de la feature (validación, mensajes de error…), sin React si es posible
  index.ts      API pública: lo que importan las pantallas de src/app
```

Reglas:

- Las pantallas de `src/app` (rutas de App Router de Next) son finas: componen features, no contienen lógica.
- Desde fuera de la feature se importa **solo** `@/features/<feature>` (su `index.ts`), nunca rutas internas.
- Una feature puede usar `src/components`, `src/hooks` y `src/lib`; `src/components` nunca importa de features.
- Los hooks que exporta `index.ts` llevan `'use client'`: el `index.ts` también lo evalúan los Server Components.

## Ejemplo: `auth`

```
features/auth/
  auth-context.ts            tipos del estado de sesión y el contexto de React
  components/AuthProvider    estado de sesión (users.me), login, register, logout, sesión caducada → /login
  components/LoginForm       formulario accesible; valida con LoginRequestSchema antes de enviar
  components/RegisterForm    idem con RegisterRequestSchema (+ confirmación de contraseña solo en la UI)
  components/RequireAuth     protección de UX en cliente (la protección real la hace la API)
  components/AccountPanel    datos del usuario y cierre de sesión
  components/AuthNav         enlaces de la cabecera según la sesión
  hooks/use-auth             acceso al contexto
  lib/auth-error-message     ApiError → mensaje genérico para el usuario
  lib/form-validation        validación con los esquemas Zod de @rulet/shared y mensajes en español
```

Seguridad en web: la sesión vive en cookies httpOnly emitidas por la API (`credentials: 'include'`). Los tokens
nunca llegan a JavaScript, `localStorage` ni `sessionStorage`. Las redirecciones tras el login (`?next=`) pasan
siempre por `safeRedirectPath` (`src/lib/safe-redirect.ts`): solo rutas internas.
