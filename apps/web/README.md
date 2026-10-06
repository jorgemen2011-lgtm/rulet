# @rulet/web

Web en **Next.js (App Router)**. Comparte con móvil contratos, cliente API y tokens de diseño, pero tiene su propia UI y funcionalidades exclusivas (p. ej. panel de administración).

```bash
pnpm dev:web     # http://localhost:3001
```

## Estructura

```
src/
├── app/          Rutas. Finas: componen features.
├── features/     Funcionalidades de la web (una carpeta cada una)
├── components/   UI reutilizable sin lógica de negocio
├── hooks/        useFeature…
├── lib/          env.ts (validado), api.ts (cliente)
└── styles/       CSS global y variables desde @rulet/design-tokens
```

## Producción

- `output: 'standalone'` para imagen Docker mínima (`Dockerfile`), o despliegue en Vercel.
- Cabeceras de seguridad (HSTS, X-Frame-Options, etc.) en `next.config.ts`.
- `NEXT_PUBLIC_API_URL` se incrusta en build: es pública.
