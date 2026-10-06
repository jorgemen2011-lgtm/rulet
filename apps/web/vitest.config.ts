import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      // Mismo alias que `paths` en tsconfig.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` lanza fuera de un Server Component. En los tests se usa su `empty.js`, que es lo que Next
      // resuelve con la condición `react-server`. El paquete no lo exporta, así que se apunta al fichero.
      'server-only': path.join(path.dirname(require.resolve('server-only')), 'empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
