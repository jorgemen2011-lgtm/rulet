# Añadir una funcionalidad

Ejemplo completo del [manual de desarrollo](./development-guide.md) aplicado a una funcionalidad **"favoritos"**
en web y móvil: cada usuario guarda ids de elementos, los lista y los borra, y nadie puede ver ni borrar los de
otro. Los pasos son los del [orden obligatorio](./development-guide.md#1-orden-obligatorio-de-trabajo); aquí solo
se muestra qué cambia en este caso. Las reglas de cada capa están en el manual.

| Dato        | Valor                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Dominio     | `favorites` → `/v1/favorites`, tabla `favorites`, clave `favorites` en `FEATURES` |
| Entidad     | `favorite` → `FavoriteSchema`, `CreateFavoriteRequestSchema`, `FavoriteRow`       |
| Plataformas | `web,mobile`                                                                      |

## 0. Generar el esqueleto (pasos 1–6 y 9)

```bash
pnpm gen feature --args favorites favorite web,mobile
```

Comprueba que la salida termina en `>>> Success!` (`turbo gen` sale con 0 aunque falle). Crea o edita:

| Paso | Archivo                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `packages/shared/src/features/index.ts` → `favorites: ['web', 'mobile']`                                                                                   |
| 2    | `packages/shared/src/contracts/favorites.ts` + export en `contracts/index.ts`                                                                              |
| 3    | `apps/api/src/database/schema/favorites.ts` + export en `schema/index.ts`                                                                                  |
| 4–6  | `apps/api/src/modules/favorites/` (module, controller con `@RequireFeature('favorites')`, service, repository, service.spec) y registro en `app.module.ts` |
| 9    | `apps/web/src/features/favorites/` y `apps/mobile/src/features/favorites/`                                                                                 |

Todo usa el campo de ejemplo `name`. En este ejemplo se sustituye por `itemId`: búscalo en los archivos generados
con:

```bash
grep -rn "name" packages/shared/src/contracts/favorites.ts apps/api/src/database/schema/favorites.ts \
  apps/api/src/modules/favorites apps/web/src/features/favorites apps/mobile/src/features/favorites
```

## 2. Contrato

`packages/shared/src/contracts/favorites.ts`: sustituye `name` por `itemId` en la entidad y en la petición.

```ts
export const FavoriteSchema = z.object({
  id: z.uuid(),
  itemId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// strictObject: un `userId` en el cuerpo da 400 (sin mass assignment).
export const CreateFavoriteRequestSchema = z.strictObject({
  itemId: z.string().trim().min(1).max(64),
});
```

`FavoriteListSchema` y los tipos (`Favorite`, `CreateFavoriteRequest`, `FavoriteList`) no cambian. Después:

```bash
pnpm --filter @rulet/shared build    # la API y sus tests cargan @rulet/shared desde dist
```

## 3. Tabla y migración

`apps/api/src/database/schema/favorites.ts`: cambia la columna y añade una restricción única para que un usuario
no repita el mismo elemento. La unicidad la garantiza la BD, no un `SELECT` previo.

```ts
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    // createdAt y updatedAt como los generó la plantilla
  },
  (t) => [
    index('favorites_user_id_created_at_idx').on(t.userId, t.createdAt),
    uniqueIndex('favorites_user_id_item_id_key').on(t.userId, t.itemId),
  ],
);
```

```bash
pnpm --filter @rulet/api db:generate --name favorites   # → apps/api/drizzle/0002_favorites.sql + drizzle/meta
pnpm --filter @rulet/api db:migrate                     # aplica a tu BD de desarrollo
```

Revisa el SQL: debe crear `favorites` con la FK a `users` `ON DELETE cascade`, el índice y el índice único. Súbelo
en el PR junto con `drizzle/meta/`.

## 4. Repository

`apps/api/src/modules/favorites/favorites.repository.ts`. Las consultas generadas ya filtran por propietario
(`findAllByOwner`, `findByIdForOwner`). Cambia `create` y añade el borrado, que también filtra por `user_id`:

```ts
/** Devuelve `undefined` si el usuario ya tenía ese elemento (restricción única). */
async create(data: Pick<NewFavoriteRow, 'userId' | 'itemId'>): Promise<FavoriteRow | undefined> {
  const [row] = await this.db
    .insert(favorites)
    .values(data)
    .onConflictDoNothing({ target: [favorites.userId, favorites.itemId] })
    .returning();
  return row;
}

/** `false` si no existe o es de otro usuario. */
async deleteForOwner(userId: string, id: string): Promise<boolean> {
  const deleted = await this.db
    .delete(favorites)
    .where(and(eq(favorites.id, id), eq(favorites.userId, userId)))
    .returning({ id: favorites.id });
  return deleted.length > 0;
}
```

## 5. Service y tests unitarios

`favorites.service.ts`: la proyección usa `itemId`, el duplicado es `409` (`ConflictException`) y el borrado ajeno
`404`.

```ts
export function toPublicFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    itemId: row.itemId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async create(ownerId: string, input: CreateFavoriteRequest): Promise<Favorite> {
  const row = await this.repository.create({ userId: ownerId, itemId: input.itemId });
  if (!row) throw new ConflictException('Ya está en favoritos');
  return toPublicFavorite(row);
}

async remove(ownerId: string, id: string): Promise<void> {
  // Mismo 404 si no existe o si es de otro usuario.
  if (!(await this.repository.deleteForOwner(ownerId, id))) throw new NotFoundException('Recurso no encontrado');
}
```

En `favorites.service.spec.ts`: adapta `row` y las llamadas a `itemId`, añade `deleteForOwner: vi.fn<…>()` al
repositorio simulado y tests para el `409` y para que `remove` pasa el propietario y lanza `404`.

```bash
pnpm turbo run test --filter=@rulet/api
```

## 6. Controller

`favorites.controller.ts` ya trae `@RequireFeature('favorites')`, `GET /`, `GET /:id` y `POST /` con el propietario
de `@CurrentUser()`. Añade el borrado (importa `Delete`, `HttpCode` y `HttpStatus` de `@nestjs/common`):

```ts
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
remove(@CurrentUser() current: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
  return this.service.remove(current.id, id);
}
```

Sin `@Public()`: el `JwtAuthGuard` global exige sesión. Desde web, el `DELETE` con cookies pasa por `CsrfGuard`
(el navegador envía `Origin`).

## 7. Tests e2e

`apps/api/test/favorites.e2e-spec.ts`, con los helpers de `test/support/app.ts` (patrón completo en el
[manual](./development-guide.md#53-cómo-escribir-un-test-e2e)). La tabla tiene FK a `users`, así que
`resetDatabase()` la vacía por el `CASCADE`.

```ts
it('nadie lee ni borra favoritos ajenos', async () => {
  const ana = await signUp(app);
  const eva = await signUp(app);
  const res = await ana.client
    .post('/v1/favorites')
    .set('authorization', ana.auth)
    .send({ itemId: 'a1' })
    .expect(201);
  const { id } = FavoriteSchema.parse(res.body);

  await eva.client.get(`/v1/favorites/${id}`).set('authorization', eva.auth).expect(404);
  await eva.client.delete(`/v1/favorites/${id}`).set('authorization', eva.auth).expect(404);
  expect((await eva.client.get('/v1/favorites').set('authorization', eva.auth).expect(200)).body).toEqual([]);
  await ana.client.delete(`/v1/favorites/${id}`).set('authorization', ana.auth).expect(204);
});
```

Casos mínimos además de ese: `401` sin `authorization`, `400` con `{ itemId: 'a1', userId: '…' }`, `400` con un id
que no es UUID, `409` al repetir `itemId` y `403` sin cabecera de plataforma (`@RequireFeature`).

```bash
pnpm test:e2e
```

## 8. Cliente

No hace falta tocar `@rulet/api-client`: los hooks usan `api.request`, que añade `/v1`, la cabecera de plataforma
y las credenciales, serializa `body` a JSON, renueva la sesión ante un 401 y valida la respuesta.

```ts
api.request(FavoriteListSchema, '/favorites', { signal }); // generado
api.request(FavoriteSchema, '/favorites', { method: 'POST', body: { itemId } });
api.request(z.undefined(), `/favorites/${id}`, { method: 'DELETE' }); // 204 sin cuerpo
```

## 9. UI en web y móvil

Generado:

```
apps/web/src/features/favorites/                apps/mobile/src/features/favorites/
├── index.ts                                    ├── index.ts
├── hooks/use-favorites.ts                      ├── hooks/use-favorites.ts
├── lib/favorites-error-message.ts              ├── errors.ts
└── components/FavoriteList.tsx (+ .module.css) └── components/FavoriteList.tsx
```

- En `FavoriteList.tsx` de cada plataforma, cambia `item.name` por `item.itemId`.
- Las acciones (añadir, borrar) van en el hook (`use-favorites.ts`) o en un hook nuevo de la feature, nunca en el
  componente. Los errores se muestran con `favoritesErrorMessage(error)`: mensajes fijos, nunca el texto del
  servidor. Añade los casos de `409` y `404` si los quieres distinguir.
- Expón lo que necesiten las pantallas en `index.ts`.
- Pantallas: web `apps/web/src/app/favorites/page.tsx` con `<RequireAuth><FavoriteList /></RequireAuth>`
  (importados de `@/features/auth` y `@/features/favorites`); móvil `apps/mobile/src/app/(app)/favorites.tsx`, dentro
  del grupo con sesión. Usa `useFeature('favorites')` donde haya que ocultar la entrada a la pantalla.

## 10. Documentación

En este ejemplo no hay variables de entorno nuevas ni una decisión de arquitectura, así que no hace falta ADR. Si la
funcionalidad necesitara, por ejemplo, un almacenamiento externo, iría su ADR en `docs/adr/` y sus variables en
[environments.md](./environments.md).

## 11. Verificación y PR

```bash
pnpm check
pnpm test:e2e
pnpm build
```

Rama `feat/favorites`; commits como `feat(shared): añadir contrato de favoritos`, `feat(api): añadir módulo de
favoritos`, `feat(web,mobile): añadir lista de favoritos`; PR con la plantilla completa (incluida la migración) y
fusión con squash. Detalle en el [manual](./development-guide.md#7-flujo-git).
