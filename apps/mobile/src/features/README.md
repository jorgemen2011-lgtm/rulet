# Features (móvil)

Una carpeta por funcionalidad; solo lo que existe en móvil o tiene UI propia de móvil.

```
features/<feature>/
  components/   UI de la feature (StyleSheet con valores de src/theme)
  hooks/        estado y llamadas a la API (usan src/lib/api)
  errors.ts     ApiError → mensaje fijo (nunca el texto del servidor)
  validation.ts lógica pura de formularios, con su validation.test.ts (si hay formularios)
  index.ts      API pública: lo que importan las pantallas de src/app
```

Las pantallas de `src/app` (rutas de expo-router) son finas: componen features, no contienen lógica ni tests (expo-router
trataría cada archivo como una ruta). Las pantallas con sesión van en `src/app/(app)/`.

Estructura canónica, reglas por capa y generador (`pnpm gen client-feature --args mobile <dominio> <entidad>`):
[Manual de desarrollo § 3](../../../../docs/development-guide.md#3-estructura-de-carpetas-canónica).
