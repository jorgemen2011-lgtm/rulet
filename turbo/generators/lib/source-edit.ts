/**
 * Ediciones de código fuente como funciones puras (texto → texto). Son deliberadamente estrictas: si el archivo
 * no tiene la forma esperada lanzan un error explicando qué falta, en vez de insertar en un sitio arbitrario.
 * Un generador que falla con un mensaje claro es mejor que uno que deja el repo a medio editar.
 */

/** Bloque contiguo de líneas que cumplen `matcher`. Lanza si no hay ninguno o si hay varios separados. */
function findBlock(lines: readonly string[], matcher: RegExp, description: string): [number, number] {
  const indexes = lines.flatMap((line, index) => (matcher.test(line) ? [index] : []));
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  if (first === undefined || last === undefined) throw new Error(`No se encuentra ${description}.`);
  if (last - first + 1 !== indexes.length) {
    throw new Error(`${description} no es un bloque contiguo; ordénalo a mano antes de usar el generador.`);
  }
  return [first, last];
}

/** Inserta `line` dentro del bloque [first, last] manteniendo el orden alfabético. */
function insertSorted(lines: string[], first: number, last: number, line: string): void {
  if (lines.slice(first, last + 1).includes(line)) throw new Error(`La línea ya existe: ${line.trim()}`);
  let position = last + 1;
  for (let index = first; index <= last; index++) {
    const current = lines[index];
    if (current !== undefined && current.trim() > line.trim()) {
      position = index;
      break;
    }
  }
  lines.splice(position, 0, line);
}

/**
 * Añade `line` al bloque contiguo de líneas que cumplen `matcher` (p. ej. los `export * from` de un índice o
 * los imports de módulos), en orden alfabético.
 */
export function insertIntoSortedBlock(
  source: string,
  line: string,
  matcher: RegExp,
  description: string,
): string {
  const lines = source.split('\n');
  const [first, last] = findBlock(lines, matcher, description);
  insertSorted(lines, first, last, line);
  return lines.join('\n');
}

/**
 * Añade `entry` (p. ej. `OrderItemsModule,`) al bloque que empieza justo después de la línea `marker`, con la
 * indentación del marcador y en orden alfabético. El marcador debe aparecer exactamente una vez.
 */
export function insertAfterMarker(
  source: string,
  marker: string,
  entry: string,
  blockMatcher: RegExp,
): string {
  const lines = source.split('\n');
  const markerIndexes = lines.flatMap((line, index) => (line.trim() === marker ? [index] : []));
  const markerIndex = markerIndexes[0];
  if (markerIndex === undefined || markerIndexes.length !== 1) {
    throw new Error(
      `El marcador "${marker}" debe aparecer exactamente una vez (aparece ${markerIndexes.length}).`,
    );
  }
  const indent = /^\s*/.exec(lines[markerIndex] ?? '')?.[0] ?? '';
  const newLine = `${indent}${entry}`;

  let last = markerIndex;
  while (last + 1 < lines.length && blockMatcher.test(lines[last + 1] ?? '')) last++;
  if (last === markerIndex) {
    lines.splice(markerIndex + 1, 0, newLine);
  } else {
    insertSorted(lines, markerIndex + 1, last, newLine);
  }
  return lines.join('\n');
}

const FEATURES_CLOSING = '} as const satisfies Record<string, readonly Platform[]>;';

/** Registra una funcionalidad en el catálogo `FEATURES` de @rulet/shared. */
export function addFeatureToCatalog(source: string, key: string, platforms: readonly string[]): string {
  if (platforms.length === 0) throw new Error('Una funcionalidad necesita al menos una plataforma.');
  const lines = source.split('\n');
  const closingIndexes = lines.flatMap((line, index) => (line.trim() === FEATURES_CLOSING ? [index] : []));
  const closingIndex = closingIndexes[0];
  if (closingIndex === undefined || closingIndexes.length !== 1) {
    throw new Error(`No se encuentra el cierre del catálogo FEATURES ("${FEATURES_CLOSING}").`);
  }
  if (new RegExp(`^\\s+${key}\\s*:`, 'm').test(source)) {
    throw new Error(`La funcionalidad "${key}" ya está en FEATURES.`);
  }
  const value = platforms.map((platform) => `'${platform}'`).join(', ');
  lines.splice(closingIndex, 0, `  ${key}: [${value}],`);
  return lines.join('\n');
}
