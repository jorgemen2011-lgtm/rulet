import { defineConfig } from 'vitest/config';

/**
 * Tests unitarios de la lógica pura (validación, configuración, mensajes de error, primera ejecución). Corren
 * en Node: los módulos bajo prueba no importan React Native ni módulos nativos de Expo. Nunca bajo src/app,
 * donde expo-router trataría cada archivo como una ruta.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '*.test.ts'],
    exclude: ['src/app/**', 'node_modules/**'],
  },
});
