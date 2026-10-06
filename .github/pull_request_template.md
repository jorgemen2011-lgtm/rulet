## Qué cambia y por qué

<!-- Resumen breve. Enlaza el issue si existe. -->

## Plataformas afectadas

- [ ] API
- [ ] Web
- [ ] Móvil
- [ ] Paquetes compartidos

## Checklist

- [ ] `pnpm check` pasa en local (y `pnpm test:e2e` si cambia la API)
- [ ] Sigue el orden de trabajo y la Definition of Done de `docs/development-guide.md`
- [ ] Si cambia un contrato de `@rulet/shared`, API y clientes están actualizados en este PR
- [ ] Si añade una funcionalidad, está registrada en `FEATURES` con sus plataformas
- [ ] Si añade variables de entorno, están en `.env.example` y en `docs/environments.md`
- [ ] Si toma una decisión de arquitectura, hay un ADR en `docs/adr/`
- [ ] Si cambia el esquema de la BD, incluye la migración generada (`pnpm --filter @rulet/api db:generate`)

## Seguridad

<!-- Checklist completa: docs/security.md, sección 8a. -->

- [ ] No incluye secretos, tokens ni datos personales (tampoco en tests, logs o capturas)
- [ ] Toda entrada externa se valida con un esquema Zod antes de usarse
- [ ] Las rutas nuevas de la API son privadas por defecto; si alguna es `@Public()`, está justificado
- [ ] Si toca auth, sesiones, cookies, CORS/CSRF o permisos, lo ha revisado un code owner
