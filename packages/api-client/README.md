# @rulet/api-client

Cliente HTTP tipado para web y móvil.

```ts
const api = createApiClient({ baseUrl: env.API_URL, platform: 'mobile', getToken });
const health = await api.health();
```

- Valida cada respuesta contra su contrato de `@rulet/shared`.
- Añade `x-client-platform` y `Authorization` automáticamente.
- Lanza `ApiError` (con `status` y el cuerpo `ApiErrorResponse`) ante cualquier error.
- `request(schema, path)` llama a rutas versionadas (`/v1/...`).
