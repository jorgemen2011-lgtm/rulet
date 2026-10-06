# Features (móvil)

Una carpeta por funcionalidad; solo lo que existe en móvil o tiene UI propia de móvil.

```
features/<feature>/
  components/   UI de la feature
  hooks/        estado y llamadas a la API (usan src/lib/api)
  index.ts      API pública: lo que importan las pantallas de src/app
```

Las pantallas de `src/app` (rutas de expo-router) son finas: componen features, no contienen lógica.
