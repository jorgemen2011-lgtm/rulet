# 0003. Next.js para la web, separada de la app móvil

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

La web tendrá funcionalidades que no existen en móvil (p. ej. panel de administración) y viceversa. Necesita SEO y buen rendimiento en escritorio.

## Decisión

App web independiente con **Next.js (App Router)**. Comparte con móvil la lógica (contratos, cliente API, tokens de diseño), **no** la UI.

## Alternativas consideradas

- **Expo Web / React Native Web** — reutiliza pantallas, pero condiciona la web a componentes de móvil y complica SEO y funcionalidades propias de escritorio.
- **Vite SPA** — sin SSR ni SEO.

## Consecuencias

- Cada plataforma tiene la UI que le conviene.
- La duplicación de UI se compensa compartiendo todo lo que no es UI en `packages/`.
- Si en el futuro se quisiera compartir componentes, se haría con un paquete `@rulet/ui` y un ADR nuevo.
