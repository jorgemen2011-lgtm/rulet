import globals from 'globals';
import base from './base.js';

/** API (NestJS). */
export default [
  ...base,
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      // Nest necesita las importaciones de valor para la inyección de dependencias por metadatos.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'next', 'next/*', 'expo', 'expo-*'],
              message: 'La API no depende de UI.',
            },
            { group: ['@rulet/*/src/*'], message: 'Importa solo la API pública del paquete.' },
          ],
        },
      ],
    },
  },
];
