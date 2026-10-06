import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DomainNames } from './names';

/** Plataformas con UI. Debe coincidir con `Platform` de @rulet/shared. */
export const PLATFORMS = ['web', 'mobile'] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);
}

/** Rutas (relativas a la raíz del repo) que leen o escriben los generadores. */
export const paths = {
  appModule: 'apps/api/src/app.module.ts',
  schemaDir: 'apps/api/src/database/schema',
  schemaIndex: 'apps/api/src/database/schema/index.ts',
  schemaTable: (n: DomainNames) => `apps/api/src/database/schema/${n.name}.ts`,
  apiModuleDir: (n: DomainNames) => `apps/api/src/modules/${n.name}`,
  contractsDir: 'packages/shared/src/contracts',
  contractsIndex: 'packages/shared/src/contracts/index.ts',
  contract: (n: DomainNames) => `packages/shared/src/contracts/${n.name}.ts`,
  featuresCatalog: 'packages/shared/src/features/index.ts',
  clientFeatureDir: (platform: Platform, n: DomainNames) => `apps/${platform}/src/features/${n.name}`,
} as const;

/** Línea de app.module.ts tras la que se registran los módulos de dominio. */
export const APP_MODULE_MARKER = '// Módulos de dominio: uno por carpeta en src/modules.';

/** Identificadores que exporta el contrato generado. La API y los clientes dependen de estos nombres. */
export function contractExports(n: DomainNames) {
  return {
    entity: `${n.entityPascal}Schema`,
    createRequest: `Create${n.entityPascal}RequestSchema`,
    list: `${n.entityPascal}ListSchema`,
  };
}

/** Comprueba requisitos y acumula los problemas, para informar de todos a la vez antes de escribir nada. */
export class Preflight {
  private readonly problems: string[] = [];

  constructor(private readonly root: string) {}

  private abs(relative: string): string {
    return path.join(this.root, relative);
  }

  read(relative: string): string | undefined {
    const file = this.abs(relative);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  }

  fail(problem: string): void {
    this.problems.push(problem);
  }

  mustNotExist(relative: string): void {
    if (existsSync(this.abs(relative))) this.fail(`Ya existe ${relative}.`);
  }

  mustContain(relative: string, needle: string, description: string): void {
    const source = this.read(relative);
    if (source === undefined) this.fail(`No existe ${relative}.`);
    else if (!source.includes(needle)) this.fail(`${relative} no contiene ${description}.`);
  }

  /** Ningún archivo `.ts` de `dir` debe exportar ya `identifier` (evita choques en el barrel `export *`). */
  identifierMustBeFree(dir: string, identifier: string): void {
    const absDir = this.abs(dir);
    if (!existsSync(absDir)) return;
    const declaration = new RegExp(`export\\s+(?:const|type|interface|function|class)\\s+${identifier}\\b`);
    for (const file of readdirSync(absDir).filter((name) => name.endsWith('.ts'))) {
      if (declaration.test(readFileSync(path.join(absDir, file), 'utf8'))) {
        this.fail(`${dir}/${file} ya exporta ${identifier}.`);
      }
    }
  }

  /** El contrato debe existir y exportar los esquemas que usará el código generado. */
  contractMustExport(n: DomainNames, identifiers: readonly string[]): void {
    const relative = paths.contract(n);
    const source = this.read(relative);
    if (source === undefined) {
      this.fail(
        `No existe ${relative}. Genera antes el contrato: pnpm gen contract --args ${n.name} ${n.entity}`,
      );
      return;
    }
    const missing = identifiers.filter((id) => !new RegExp(`export\\s+const\\s+${id}\\b`).test(source));
    if (missing.length > 0) {
      this.fail(
        `${relative} no exporta ${missing.join(', ')}. ¿Has usado la misma entidad que en el contrato?`,
      );
    }
  }

  /** Lanza un único error con todos los problemas encontrados. */
  assertOk(): string {
    if (this.problems.length > 0) {
      throw new Error(`No se ha generado nada:\n  - ${this.problems.join('\n  - ')}`);
    }
    return 'Comprobaciones previas correctas';
  }
}

/** Aplica una edición pura a un archivo existente. */
export function editFile(root: string, relative: string, edit: (source: string) => string): string {
  const file = path.join(root, relative);
  writeFileSync(file, edit(readFileSync(file, 'utf8')));
  return relative;
}

/**
 * Formatea con el Prettier del repo. Las plantillas ya están formateadas, pero un nombre largo puede superar el
 * ancho de línea, y `pnpm format:check` (CI) fallaría con código recién generado.
 */
export function formatWithPrettier(root: string, files: readonly string[]): string {
  const requireFromRoot = createRequire(path.join(root, 'package.json'));
  const prettierDir = path.dirname(requireFromRoot.resolve('prettier/package.json'));
  execFileSync(
    process.execPath,
    [path.join(prettierDir, 'bin', 'prettier.cjs'), '--write', '--log-level', 'warn', ...files],
    { cwd: root, stdio: 'inherit' },
  );
  return `Formateados ${files.length} archivos con Prettier`;
}
