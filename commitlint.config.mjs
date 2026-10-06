/**
 * Conventional Commits: `<tipo>(<ámbito>): <descripción en imperativo>` (ver docs/conventions.md).
 * Lo comprueba el hook `commit-msg` de Husky. El ámbito es obligatorio para que el historial diga
 * siempre qué parte del monorepo cambia.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'mobile',
        'shared',
        'api-client',
        'design-tokens',
        'eslint-config',
        'repo',
        'deps',
        'ci',
        'docs',
      ],
    ],
  },
};
