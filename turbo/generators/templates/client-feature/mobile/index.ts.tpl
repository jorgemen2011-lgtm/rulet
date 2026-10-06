/**
 * API pública de la feature {{name}}. Las pantallas de src/app solo importan desde aquí.
 * La autorización la decide la API; lo que hay en esta feature es UX.
 */
export { {{entityPascal}}List } from './components/{{entityPascal}}List';
export { use{{namePascal}} } from './hooks/use-{{name}}';
export type { {{namePascal}}State, Use{{namePascal}}Result } from './hooks/use-{{name}}';
