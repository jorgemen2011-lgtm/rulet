import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/** Reglas comunes a todo el monorepo. */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/*.config.*',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      // Seguridad: nada de ejecutar cadenas como código (inyección de código).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      // La configuración se lee y valida una sola vez en el módulo de entorno de cada app; el resto del
      // código recibe valores ya tipados. Así no se cuela una variable sin validar ni un secreto por error.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Lee la configuración del módulo de entorno de la app (config/env.ts o lib/env.ts), no de process.env.',
        },
      ],
    },
  },
  {
    // Únicos sitios donde se permite leer process.env: los módulos de entorno, el migrador (proceso
    // independiente de la app) y los tests. Los *.config.* ya están ignorados arriba.
    files: [
      '**/config/env.ts',
      '**/lib/env.ts',
      '**/database/migrate.ts',
      'test/**',
      '**/test/**',
      '**/*.spec.ts',
      '**/*.e2e-spec.ts',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  prettier,
);
