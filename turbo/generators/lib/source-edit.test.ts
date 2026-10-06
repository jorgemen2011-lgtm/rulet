import { describe, expect, it } from 'vitest';
import { addFeatureToCatalog, insertAfterMarker, insertIntoSortedBlock } from './source-edit';

const EXPORT_LINE = /^export \* from '\.\/[^']+';$/;
const MODULE_ENTRY_LINE = /^\s+[A-Z]\w*Module,$/;
const MARKER = '// Módulos de dominio: uno por carpeta en src/modules.';

describe('insertIntoSortedBlock', () => {
  const index = ['/** Esquema. */', "export * from './sessions.js';", "export * from './users.js';", ''].join(
    '\n',
  );

  it('inserta en orden alfabético dentro del bloque', () => {
    const result = insertIntoSortedBlock(index, "export * from './tasks.js';", EXPORT_LINE, 'exports');
    expect(result.split('\n')).toEqual([
      '/** Esquema. */',
      "export * from './sessions.js';",
      "export * from './tasks.js';",
      "export * from './users.js';",
      '',
    ]);
  });

  it('inserta al final si va después de todas', () => {
    const result = insertIntoSortedBlock(index, "export * from './zz.js';", EXPORT_LINE, 'exports');
    expect(result.split('\n').at(-2)).toBe("export * from './zz.js';");
  });

  it('rechaza duplicados y archivos sin bloque', () => {
    expect(() => insertIntoSortedBlock(index, "export * from './users.js';", EXPORT_LINE, 'exports')).toThrow(
      /ya existe/,
    );
    expect(() =>
      insertIntoSortedBlock('const a = 1;\n', "export * from './a';", EXPORT_LINE, 'exports'),
    ).toThrow(/No se encuentra/);
  });

  it('rechaza un bloque no contiguo', () => {
    const split = ["export * from './a';", 'const x = 1;', "export * from './c';"].join('\n');
    expect(() => insertIntoSortedBlock(split, "export * from './b';", EXPORT_LINE, 'exports')).toThrow(
      /contiguo/,
    );
  });
});

describe('insertAfterMarker', () => {
  const appModule = [
    '  imports: [',
    '    AppConfigModule,',
    `    ${MARKER}`,
    '    AuthModule,',
    '    UsersModule,',
    '  ],',
  ].join('\n');

  it('añade la entrada en el bloque tras el marcador, con su indentación y en orden', () => {
    const result = insertAfterMarker(appModule, MARKER, 'TasksModule,', MODULE_ENTRY_LINE);
    expect(result.split('\n').slice(3)).toEqual([
      '    AuthModule,',
      '    TasksModule,',
      '    UsersModule,',
      '  ],',
    ]);
  });

  it('no mueve las entradas anteriores al marcador', () => {
    const result = insertAfterMarker(appModule, MARKER, 'AaaModule,', MODULE_ENTRY_LINE);
    expect(result.split('\n').slice(1, 4)).toEqual([
      '    AppConfigModule,',
      `    ${MARKER}`,
      '    AaaModule,',
    ]);
  });

  it('inserta justo después del marcador si el bloque está vacío', () => {
    const empty = [`    ${MARKER}`, '  ],'].join('\n');
    expect(insertAfterMarker(empty, MARKER, 'TasksModule,', MODULE_ENTRY_LINE)).toBe(
      [`    ${MARKER}`, '    TasksModule,', '  ],'].join('\n'),
    );
  });

  it('exige el marcador exactamente una vez y rechaza duplicados', () => {
    expect(() => insertAfterMarker('  imports: [],', MARKER, 'TasksModule,', MODULE_ENTRY_LINE)).toThrow(
      /exactamente una vez/,
    );
    expect(() => insertAfterMarker(appModule, MARKER, 'UsersModule,', MODULE_ENTRY_LINE)).toThrow(
      /ya existe/,
    );
  });
});

describe('addFeatureToCatalog', () => {
  const catalog = [
    'export const FEATURES = {',
    "  auth: ['web', 'mobile'],",
    '} as const satisfies Record<string, readonly Platform[]>;',
  ].join('\n');

  it('añade la clave antes del cierre del catálogo', () => {
    expect(addFeatureToCatalog(catalog, 'orderItems', ['web'])).toContain(
      "  auth: ['web', 'mobile'],\n  orderItems: ['web'],\n} as const",
    );
  });

  it('rechaza claves existentes, catálogos sin cierre reconocible y listas vacías', () => {
    expect(() => addFeatureToCatalog(catalog, 'auth', ['web'])).toThrow(/ya está/);
    expect(() => addFeatureToCatalog('export const FEATURES = {};', 'x', ['web'])).toThrow(/cierre/);
    expect(() => addFeatureToCatalog(catalog, 'x', [])).toThrow(/al menos una/);
  });
});
