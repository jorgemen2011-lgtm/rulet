/**
 * Validación y derivación de nombres. Todo identificador que acaba en el código generado sale de aquí, para que
 * archivos, clases, tablas y rutas sigan siempre la misma convención (docs/conventions.md).
 */

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 40;

// Palabras reservadas de JavaScript/TypeScript: generarían identificadores inválidos (`export const delete`).
const RESERVED_WORDS = new Set([
  'abstract',
  'any',
  'arguments',
  'as',
  'async',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'module',
  'namespace',
  'never',
  'new',
  'null',
  'number',
  'object',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'readonly',
  'require',
  'return',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'unique',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/** Nombres que chocarían con carpetas o conceptos transversales del repo. */
const RESERVED_NAMES = new Set(['app', 'common', 'config', 'database', 'index', 'lib', 'shared', 'test']);

/** Validador para los prompts: `true` o el mensaje de error que verá quien ejecuta el generador. */
export function validateKebabName(value: unknown): true | string {
  if (typeof value !== 'string' || value.length === 0) return 'El nombre es obligatorio.';
  if (value.length > MAX_LENGTH) return `Máximo ${MAX_LENGTH} caracteres.`;
  if (!KEBAB_CASE.test(value)) {
    return 'Usa kebab-case: minúsculas, números y guiones, empezando por una letra (p. ej. "order-items").';
  }
  if (RESERVED_NAMES.has(value)) return `"${value}" está reservado en este repositorio.`;
  if (RESERVED_WORDS.has(toCamelCase(value))) return `"${value}" es una palabra reservada de TypeScript.`;
  return true;
}

function words(kebab: string): string[] {
  return kebab.split('-');
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function toPascalCase(kebab: string): string {
  return words(kebab).map(capitalize).join('');
}

export function toCamelCase(kebab: string): string {
  const pascal = toPascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(kebab: string): string {
  return words(kebab).join('_');
}

/**
 * Singular aproximado en inglés (los identificadores del código van en inglés: `users` → `user`).
 * Solo es el valor por defecto del prompt: quien ejecuta el generador puede corregirlo (`news`, `people`…).
 */
export function singularize(kebab: string): string {
  if (/[^aeiou]ies$/.test(kebab)) return `${kebab.slice(0, -3)}y`;
  if (/(?:ss|sh|ch|x|z)es$/.test(kebab)) return kebab.slice(0, -2);
  // `status`, `analysis`, `address`: ya son singulares.
  if (/[^siu]s$/.test(kebab)) return kebab.slice(0, -1);
  return kebab;
}

/** Identificadores derivados de un dominio (`order-items`) y su entidad en singular (`order-item`). */
export interface DomainNames {
  /** kebab-case del dominio: carpeta, archivos y ruta HTTP (`order-items`). */
  name: string;
  /** Prefijo de clases Nest (`OrderItems` → `OrderItemsService`). */
  namePascal: string;
  /** Constante de la tabla Drizzle y clave en FEATURES (`orderItems`). */
  nameCamel: string;
  /** Nombre de la tabla en PostgreSQL (`order_items`). */
  nameSnake: string;
  /** kebab-case de la entidad (`order-item`). */
  entity: string;
  /** Tipos y esquemas del contrato (`OrderItem`, `OrderItemSchema`, `OrderItemRow`). */
  entityPascal: string;
}

export function deriveNames(name: string, entity: string): DomainNames {
  return {
    name,
    namePascal: toPascalCase(name),
    nameCamel: toCamelCase(name),
    nameSnake: toSnakeCase(name),
    entity,
    entityPascal: toPascalCase(entity),
  };
}
