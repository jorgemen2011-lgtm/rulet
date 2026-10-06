import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.js';

const DANGEROUS_HTML_MESSAGE =
  'dangerouslySetInnerHTML permite XSS: renderiza el contenido como texto o sanéalo explícitamente.';

/** Apps React (web y móvil). */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Insertar HTML sin escapar abre la puerta a XSS. Si de verdad hace falta, se sanea y se desactiva
      // la regla en esa línea con un comentario que lo justifique.
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: DANGEROUS_HTML_MESSAGE },
        {
          // También vía objetos de props (spread o React.createElement), con la clave con o sin comillas.
          selector:
            "Property[key.name='dangerouslySetInnerHTML'], Property[key.value='dangerouslySetInnerHTML']",
          message: DANGEROUS_HTML_MESSAGE,
        },
      ],
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
