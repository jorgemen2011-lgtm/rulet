import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.js';

/** Apps React (web y móvil). */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*'], message: 'El código de servidor vive en apps/api.' },
            { group: ['@rulet/*/src/*'], message: 'Importa solo la API pública del paquete.' },
          ],
        },
      ],
    },
  },
];
