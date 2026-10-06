# Añadir una funcionalidad

Ejemplo: una funcionalidad **"favoritos"** disponible en web y móvil. Sigue los pasos en orden; cada uno se apoya en el anterior y TypeScript te guía.

## 1. Regístrala en el catálogo

`packages/shared/src/features/index.ts`

```ts
export const FEATURES = {
  // ...
  favorites: ['web', 'mobile'],
};
```

Si solo existe en una plataforma, pon solo esa.

## 2. Define el contrato

`packages/shared/src/contracts/favorites.ts`

```ts
import { z } from 'zod';

export const FavoriteSchema = z.object({ id: z.uuid(), itemId: z.string(), createdAt: z.iso.datetime() });
export const CreateFavoriteSchema = FavoriteSchema.pick({ itemId: true });
export const FavoriteListSchema = z.array(FavoriteSchema);

export type Favorite = z.infer<typeof FavoriteSchema>;
export type CreateFavorite = z.infer<typeof CreateFavoriteSchema>;
```

Y expórtalo en `packages/shared/src/contracts/index.ts`.

## 3. Implementa el módulo en la API

```
apps/api/src/modules/favorites/
├── favorites.module.ts
├── favorites.controller.ts
├── favorites.service.ts
└── favorites.service.spec.ts
```

```ts
@Controller('favorites')
@RequireFeature('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(): Promise<Favorite[]> {
    return this.favorites.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateFavoriteSchema)) dto: CreateFavorite): Promise<Favorite> {
    return this.favorites.create(dto);
  }
}
```

Registra `FavoritesModule` en `app.module.ts`. La ruta queda en `/v1/favorites`.

- El **controller** solo traduce HTTP ↔ servicio.
- El **service** contiene la lógica de negocio y es lo que se testea.
- El acceso a datos va detrás de un repositorio inyectable, para poder cambiar la persistencia sin tocar la lógica.

## 4. Añádela al cliente API

`packages/api-client/src/client.ts`

```ts
favorites: {
  list: () => request(FavoriteListSchema, '/favorites'),
  create: (body: CreateFavorite) =>
    request(FavoriteSchema, '/favorites', { method: 'POST', body: JSON.stringify(body) }),
},
```

## 5. Construye la UI en cada plataforma

```
apps/mobile/src/features/favorites/   apps/web/src/features/favorites/
├── components/FavoriteButton.tsx     ├── components/FavoriteButton.tsx
├── hooks/use-favorites.ts            ├── hooks/use-favorites.ts
└── index.ts                          └── index.ts
```

Usa `api.favorites.*` desde los hooks y `useFeature('favorites')` donde haga falta. Las pantallas de `src/app` solo componen lo que exporta `features/favorites/index.ts`.

## 6. Comprueba

```bash
pnpm check
```

Y marca la checklist de la plantilla de PR.
