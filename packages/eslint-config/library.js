import base from './base.js';

/**
 * Paquetes compartidos (packages/*): deben funcionar igual en web, móvil y servidor,
 * así que no pueden depender de nada específico de una plataforma.
 */
export default [
  ...base,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'react-native',
                'react-native-*',
                'expo',
                'expo-*',
                'next',
                'next/*',
                '@nestjs/*',
              ],
              message: 'packages/* es agnóstico de plataforma: mueve este código a apps/<plataforma>.',
            },
            { group: ['@rulet/*/src/*', '**/apps/**'], message: 'Importa solo la API pública del paquete.' },
          ],
        },
      ],
    },
  },
];
