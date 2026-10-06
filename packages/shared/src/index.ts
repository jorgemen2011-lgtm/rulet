/**
 * API pública de @rulet/shared. Todo lo que no se exporte aquí es interno.
 *
 * - domain:    tipos y reglas de negocio puras (sin I/O).
 * - contracts: esquemas Zod de peticiones/respuestas HTTP; la fuente de verdad
 *              que comparten la API (validación) y los clientes (tipado).
 * - features:  catálogo de funcionalidades por plataforma.
 */
export * from './auth-transport';
export * from './contracts';
export * from './domain';
export * from './features';
export * from './platform';
