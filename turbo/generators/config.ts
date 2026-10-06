import type { PlopTypes } from '@turbo/gen';
import { deriveNames, singularize, validateKebabName, type DomainNames } from './lib/names';
import {
  APP_MODULE_MARKER,
  contractExports,
  editFile,
  formatWithPrettier,
  isPlatform,
  paths,
  PLATFORMS,
  Preflight,
  type Platform,
} from './lib/project';
import { addFeatureToCatalog, insertAfterMarker, insertIntoSortedBlock } from './lib/source-edit';

/**
 * Generadores de código del monorepo: crean piezas nuevas con la MISMA arquitectura que las existentes.
 * Uso y ejemplos en turbo/generators/README.md. Resumen:
 *
 *   pnpm gen contract       --args <dominio> <entidad>
 *   pnpm gen api-module     --args <dominio> <entidad>
 *   pnpm gen client-feature --args <web|mobile> <dominio> <entidad>
 *   pnpm gen feature        --args <dominio> <entidad> <web,mobile>
 *
 * Cada generador comprueba TODO antes de escribir (archivos que ya existen, marcadores, contrato) y aborta sin
 * tocar nada si algo falla. Al final formatea con Prettier lo que ha creado o editado.
 */

// Las plantillas (Handlebars) usan la extensión `.tpl` y no `.hbs`: Prettier formatea `.hbs` como HTML de
// Glimmer y `pnpm format` / `format:check` las romperían o fallarían. Con `.tpl` Prettier las ignora.
type ActionList = PlopTypes.ActionType[];

// Coinciden con los bloques que editan los generadores; si cambias esos archivos, mantén la forma.
const EXPORT_LINE = /^export \* from '\.\/[^']+';$/;
const MODULE_IMPORT_LINE = /^import \{ \w+Module \} from '\.\/modules\/[^']+';$/;
const MODULE_ENTRY_LINE = /^\s+[A-Z]\w*Module,$/;

const namePrompt: PlopTypes.PromptQuestion = {
  type: 'input',
  name: 'name',
  message: 'Dominio en kebab-case y en plural (carpeta y ruta HTTP), p. ej. "order-items":',
  validate: validateKebabName,
};

const entityPrompt: PlopTypes.PromptQuestion = {
  type: 'input',
  name: 'entity',
  message: 'Entidad en singular y kebab-case (tipos y esquemas), p. ej. "order-item":',
  default: (answers: PlopTypes.Answers) =>
    typeof answers.name === 'string' ? singularize(answers.name) : '',
  validate: validateKebabName,
};

const platformPrompt: PlopTypes.PromptQuestion = {
  type: 'list',
  name: 'platform',
  message: 'Plataforma:',
  choices: [...PLATFORMS],
};

const platformsPrompt: PlopTypes.PromptQuestion = {
  type: 'checkbox',
  name: 'platforms',
  message: 'Plataformas con la funcionalidad (FEATURES y UI):',
  choices: PLATFORMS.map((platform) => ({ name: platform, value: platform, checked: true })),
  validate: (value: unknown) =>
    (Array.isArray(value) && value.length > 0) || 'Elige al menos una plataforma.',
};

function namesFrom(answers: PlopTypes.Answers | undefined): DomainNames {
  const name: unknown = answers?.name;
  const entity: unknown = answers?.entity;
  if (typeof name !== 'string' || typeof entity !== 'string')
    throw new Error('Faltan el dominio o la entidad.');
  return deriveNames(name, entity);
}

function platformsFrom(answers: PlopTypes.Answers | undefined): Platform[] {
  const value: unknown = answers?.platforms;
  if (!Array.isArray(value) || value.length === 0 || !value.every(isPlatform)) {
    throw new Error('Plataformas inválidas: usa web, mobile o web,mobile.');
  }
  return [...new Set(value)];
}

function platformFrom(answers: PlopTypes.Answers | undefined): Platform {
  const value: unknown = answers?.platform;
  if (!isPlatform(value)) throw new Error('Plataforma inválida: usa web o mobile.');
  return value;
}

/** Un archivo nuevo a partir de una plantilla. Nunca sobrescribe: si existe, la acción falla y se aborta. */
function addFile(path: string, templateFile: string, data: object): PlopTypes.AddActionConfig {
  return { type: 'add', path, templateFile, data, abortOnFail: true };
}

// --- Comprobaciones previas -------------------------------------------------------------------------------

function checkContract(check: Preflight, n: DomainNames): void {
  check.mustNotExist(paths.contract(n));
  check.mustContain(paths.contractsIndex, "export * from './", 'el bloque de `export * from`');
  for (const id of Object.values(contractExports(n))) check.identifierMustBeFree(paths.contractsDir, id);
}

/** `contractPlanned`: el contrato lo crea el mismo generador (feature), así que aún no existe. */
function checkApiModule(check: Preflight, n: DomainNames, contractPlanned: boolean): void {
  check.mustNotExist(paths.apiModuleDir(n));
  check.mustNotExist(paths.schemaTable(n));
  check.mustContain(paths.appModule, APP_MODULE_MARKER, `el marcador "${APP_MODULE_MARKER}"`);
  check.mustContain(paths.schemaIndex, "export * from './", 'el bloque de `export * from`');
  check.identifierMustBeFree(paths.schemaDir, n.nameCamel);
  check.identifierMustBeFree(paths.schemaDir, `${n.entityPascal}Row`);
  if (check.read(paths.appModule)?.includes(`${n.namePascal}Module`)) {
    check.fail(`${paths.appModule} ya usa ${n.namePascal}Module.`);
  }
  if (!contractPlanned) {
    const { entity, createRequest } = contractExports(n);
    check.contractMustExport(n, [entity, createRequest]);
  }
}

function checkClientFeature(check: Preflight, platform: Platform, n: DomainNames, contractPlanned: boolean) {
  check.mustNotExist(paths.clientFeatureDir(platform, n));
  if (!contractPlanned) check.contractMustExport(n, [contractExports(n).list]);
}

function checkFeatureCatalog(check: Preflight, n: DomainNames): void {
  const source = check.read(paths.featuresCatalog);
  if (source === undefined) check.fail(`No existe ${paths.featuresCatalog}.`);
  else if (new RegExp(`^\\s+${n.nameCamel}\\s*:`, 'm').test(source)) {
    check.fail(`La funcionalidad "${n.nameCamel}" ya está en FEATURES.`);
  }
}

// --- Acciones ---------------------------------------------------------------------------------------------

function contractActions(root: string, n: DomainNames, touched: string[]): ActionList {
  touched.push(paths.contract(n), paths.contractsIndex);
  return [
    addFile(paths.contract(n), 'templates/contract/contract.ts.tpl', n),
    () =>
      editFile(root, paths.contractsIndex, (source) =>
        insertIntoSortedBlock(
          source,
          `export * from './${n.name}';`,
          EXPORT_LINE,
          'los exports de contratos',
        ),
      ),
  ];
}

function apiModuleActions(root: string, n: DomainNames, feature: boolean, touched: string[]): ActionList {
  const dir = paths.apiModuleDir(n);
  const data = { ...n, feature };
  const files = {
    module: `${dir}/${n.name}.module.ts`,
    controller: `${dir}/${n.name}.controller.ts`,
    service: `${dir}/${n.name}.service.ts`,
    repository: `${dir}/${n.name}.repository.ts`,
    spec: `${dir}/${n.name}.service.spec.ts`,
  };
  touched.push(paths.schemaTable(n), paths.schemaIndex, ...Object.values(files), paths.appModule);
  return [
    addFile(paths.schemaTable(n), 'templates/api-module/schema.ts.tpl', data),
    () =>
      editFile(root, paths.schemaIndex, (source) =>
        insertIntoSortedBlock(
          source,
          `export * from './${n.name}.js';`,
          EXPORT_LINE,
          'los exports del esquema',
        ),
      ),
    addFile(files.module, 'templates/api-module/module.ts.tpl', data),
    addFile(files.controller, 'templates/api-module/controller.ts.tpl', data),
    addFile(files.service, 'templates/api-module/service.ts.tpl', data),
    addFile(files.repository, 'templates/api-module/repository.ts.tpl', data),
    addFile(files.spec, 'templates/api-module/service.spec.ts.tpl', data),
    () =>
      editFile(root, paths.appModule, (source) => {
        const withImport = insertIntoSortedBlock(
          source,
          `import { ${n.namePascal}Module } from './modules/${n.name}/${n.name}.module.js';`,
          MODULE_IMPORT_LINE,
          'los imports de módulos de dominio',
        );
        return insertAfterMarker(withImport, APP_MODULE_MARKER, `${n.namePascal}Module,`, MODULE_ENTRY_LINE);
      }),
  ];
}

function clientFeatureActions(platform: Platform, n: DomainNames, touched: string[]): ActionList {
  const dir = paths.clientFeatureDir(platform, n);
  const templates = `templates/client-feature/${platform}`;
  const files: [path: string, template: string][] =
    platform === 'web'
      ? [
          [`${dir}/index.ts`, 'index.ts.tpl'],
          [`${dir}/hooks/use-${n.name}.ts`, 'use-hook.ts.tpl'],
          [`${dir}/lib/${n.name}-error-message.ts`, 'error-message.ts.tpl'],
          [`${dir}/components/${n.entityPascal}List.tsx`, 'list.tsx.tpl'],
          [`${dir}/components/${n.entityPascal}List.module.css`, 'list.module.css.tpl'],
        ]
      : [
          [`${dir}/index.ts`, 'index.ts.tpl'],
          [`${dir}/hooks/use-${n.name}.ts`, 'use-hook.ts.tpl'],
          [`${dir}/errors.ts`, 'errors.ts.tpl'],
          [`${dir}/components/${n.entityPascal}List.tsx`, 'list.tsx.tpl'],
        ];
  touched.push(...files.map(([path]) => path));
  return files.map(([path, template]) => addFile(path, `${templates}/${template}`, n));
}

function featureCatalogActions(root: string, n: DomainNames, platforms: Platform[], touched: string[]) {
  touched.push(paths.featuresCatalog);
  return [
    () =>
      editFile(root, paths.featuresCatalog, (source) => addFeatureToCatalog(source, n.nameCamel, platforms)),
  ];
}

/** Envuelve las acciones: comprobaciones primero, Prettier al final y los pasos siguientes como mensaje. */
function pipeline(
  root: string,
  preflight: (check: Preflight) => void,
  build: (touched: string[]) => ActionList,
) {
  const touched: string[] = [];
  const actions = build(touched);
  return [
    () => {
      const check = new Preflight(root);
      preflight(check);
      return check.assertOk();
    },
    ...actions,
    () => formatWithPrettier(root, [...new Set(touched)]),
  ];
}

const NEXT_STEPS_API = [
  'Siguientes pasos:',
  '  1. pnpm --filter @rulet/api db:generate   (migración de la tabla nueva; revisa el SQL en apps/api/drizzle)',
  '  2. pnpm --filter @rulet/shared build      (la API y los tests cargan @rulet/shared compilado)',
  '  3. pnpm turbo run lint typecheck test --filter=@rulet/api',
].join('\n');

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const root = plop.getDestBasePath();

  plop.setGenerator('contract', {
    description: 'Contrato Zod en @rulet/shared (packages/shared/src/contracts/<dominio>.ts)',
    prompts: [namePrompt, entityPrompt],
    actions: (answers) => {
      const n = namesFrom(answers);
      return pipeline(
        root,
        (check) => checkContract(check, n),
        (touched) => contractActions(root, n, touched),
      );
    },
  });

  plop.setGenerator('api-module', {
    description:
      'Módulo NestJS (controller → service → repository + tabla Drizzle + test) registrado en AppModule',
    prompts: [namePrompt, entityPrompt],
    actions: (answers) => {
      const n = namesFrom(answers);
      return [
        ...pipeline(
          root,
          (check) => checkApiModule(check, n, false),
          (touched) => apiModuleActions(root, n, false, touched),
        ),
        NEXT_STEPS_API,
      ];
    },
  });

  plop.setGenerator('client-feature', {
    description: 'Feature de UI en apps/<web|mobile>/src/features/<dominio> (index, components, hooks)',
    prompts: [platformPrompt, namePrompt, entityPrompt],
    actions: (answers) => {
      const platform = platformFrom(answers);
      const n = namesFrom(answers);
      return pipeline(
        root,
        (check) => checkClientFeature(check, platform, n, false),
        (touched) => clientFeatureActions(platform, n, touched),
      );
    },
  });

  plop.setGenerator('feature', {
    description:
      'Funcionalidad completa: contrato + FEATURES + módulo API (@RequireFeature) + UI por plataforma',
    prompts: [namePrompt, entityPrompt, platformsPrompt],
    actions: (answers) => {
      const n = namesFrom(answers);
      const platforms = platformsFrom(answers);
      return [
        ...pipeline(
          root,
          (check) => {
            checkContract(check, n);
            checkFeatureCatalog(check, n);
            checkApiModule(check, n, true);
            for (const platform of platforms) checkClientFeature(check, platform, n, true);
          },
          (touched) => [
            ...contractActions(root, n, touched),
            ...featureCatalogActions(root, n, platforms, touched),
            ...apiModuleActions(root, n, true, touched),
            ...platforms.flatMap((platform) => clientFeatureActions(platform, n, touched)),
          ],
        ),
        NEXT_STEPS_API,
      ];
    },
  });
}
