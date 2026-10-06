# Generadores de código

Crean piezas nuevas con la **misma arquitectura** que las existentes, para que nadie tenga que copiar a mano un
módulo y adaptar nombres. Están hechos con [Turborepo generators](https://turborepo.dev/docs/guides/generating-code)
(Plop por debajo) y se ejecutan desde cualquier punto del repo:

```bash
pnpm gen                      # menú interactivo
pnpm gen <generador> --args … # sin preguntas (respuestas en el orden de la tabla)
```

| Generador        | `--args`                            | Qué crea                                                                                 |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `contract`       | `<dominio> <entidad>`               | `packages/shared/src/contracts/<dominio>.ts` + export en `contracts/index.ts`            |
| `api-module`     | `<dominio> <entidad>`               | Módulo NestJS completo + tabla Drizzle, registrado en `AppModule` (requiere el contrato) |
| `client-feature` | `<web\|mobile> <dominio> <entidad>` | `apps/<plataforma>/src/features/<dominio>/` (requiere el contrato)                       |
| `feature`        | `<dominio> <entidad> <plataformas>` | Todo lo anterior + registro en `FEATURES` y `@RequireFeature` en el controller           |

- **dominio**: kebab-case y en plural. Es la carpeta, el prefijo de las clases y la ruta HTTP (`order-items` →
  `OrderItemsService`, `/v1/order-items`, tabla `order_items`).
- **entidad**: kebab-case y en singular. Nombra los tipos y esquemas (`order-item` → `OrderItemSchema`,
  `CreateOrderItemRequestSchema`, `OrderItemRow`). En modo interactivo se propone el singular del dominio; revísalo
  (`news`, `people`… no siguen la regla).
- **plataformas**: `web`, `mobile` o `web,mobile`.

Ejemplo, una funcionalidad completa en web y móvil:

```bash
pnpm gen feature --args order-items order-item web,mobile
```

## Garantías

- **Nada a medias.** Antes de escribir se comprueba todo (archivos que ya existen, identificadores repetidos,
  marcadores, contrato con los esquemas esperados) y, si algo falla, se listan todos los problemas y no se toca
  nada. Ningún archivo existente se sobrescribe.
- **Mismo estilo que el código a mano.** El resultado se formatea con el Prettier del repo y pasa `lint` y
  `typecheck` de cada paquete sin retoques.
- **Ojo:** `turbo gen` termina con código 0 aunque el generador falle. En scripts, comprueba la salida
  (`>>> Success!`), no solo el código de salida.

## Qué se genera y por qué

### `api-module`

```
apps/api/src/database/schema/<dominio>.ts     tabla con user_id (FK, on delete cascade) e índice (user_id, created_at)
apps/api/src/modules/<dominio>/
  <dominio>.module.ts                         registra controller, service y repository
  <dominio>.controller.ts                     GET /, GET /:id (ParseUUIDPipe), POST / (ZodValidationPipe)
  <dominio>.service.ts                        lógica + proyección pública con lista blanca de campos
  <dominio>.repository.ts                     único sitio con Drizzle; inyecta DATABASE
  <dominio>.service.spec.ts                   Vitest con el repositorio simulado
```

Decisiones de seguridad que trae de serie:

- **Protegido por defecto**: sin `@Public()`; el `JwtAuthGuard` global exige token. El controller incluye cómo
  restringir por rol con `@Roles('admin')`.
- **Sin IDOR**: el propietario sale del token (`@CurrentUser()`), nunca del cuerpo, y el repositorio filtra
  todas las consultas por `user_id`. Un recurso ajeno responde 404, igual que uno inexistente.
- **Sin mass assignment**: el cuerpo se valida con un `strictObject` del contrato.
- **Respuestas acotadas**: los listados tienen un tope de filas y la respuesta nunca incluye `userId`.

Se registra en `apps/api/src/app.module.ts` (import + entrada justo después de
`// Módulos de dominio: uno por carpeta en src/modules.`, en orden alfabético). Si cambias esa línea, el generador
dejará de funcionar y lo dirá.

Después de generarlo:

```bash
pnpm --filter @rulet/api db:generate     # migración SQL de la tabla nueva: revísala y súbela en el PR
pnpm --filter @rulet/shared build        # la API (y sus tests) cargan @rulet/shared compilado
pnpm turbo run lint typecheck test --filter=@rulet/api
```

### `contract`

Esquema de la entidad, petición de creación (`strictObject`) y lista, con sus tipos inferidos. Es la fuente de
verdad que comparten API y clientes (ADR 0005). Cámbialo a la forma real de tu dominio antes de generar el módulo:
la API, la tabla y la UI generadas usan el campo de ejemplo `name`.

### `client-feature`

```
apps/web/src/features/<dominio>/            apps/mobile/src/features/<dominio>/
  index.ts             API pública            index.ts
  hooks/use-<dominio>.ts                       hooks/use-<dominio>.ts
  components/<Entidad>List.tsx (+ .module.css) components/<Entidad>List.tsx
  lib/<dominio>-error-message.ts               errors.ts
```

El hook usa `api.request(<Entidad>ListSchema, '/<dominio>')` del cliente compartido: la respuesta se valida con el
contrato, la sesión se renueva sola y la petición se cancela al desmontar. Los errores se traducen a mensajes fijos:
nunca se muestra el texto del servidor. Las pantallas de `src/app` importan solo desde `index.ts`.

### `feature`

Encadena `contract`, el registro en `FEATURES` (`packages/shared/src/features/index.ts`), `api-module` con
`@RequireFeature('<dominioEnCamelCase>')` y `client-feature` para cada plataforma elegida. Sigue el orden de
[Añadir una funcionalidad](../../docs/adding-a-feature.md).

## Mantenimiento

```
turbo/generators/
  config.ts         generadores (prompts y acciones)
  lib/names.ts      validación y derivación de nombres
  lib/project.ts    rutas del repo, comprobaciones previas y Prettier
  lib/source-edit.ts ediciones de archivos existentes (funciones puras)
  templates/        plantillas Handlebars
```

Si cambias la estructura de un módulo o de una feature a mano, actualiza también la plantilla: los generadores son
la definición ejecutable de la arquitectura. Para comprobarlos:

```bash
pnpm exec tsc -p turbo/generators
pnpm exec vitest run --root turbo/generators
```

Y genera algo de prueba (p. ej. `pnpm gen feature --args zz-smokes zz-smoke web,mobile`), pasa `lint` y
`typecheck` de los paquetes afectados y descártalo.
