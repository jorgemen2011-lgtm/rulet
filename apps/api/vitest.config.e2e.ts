import { defineConfig } from 'vitest/config';
import { e2eTestEnv } from './test/test-env.js';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: e2eTestEnv,
    // Aplica las migraciones a la BD de test antes de empezar.
    globalSetup: ['./test/global-setup.ts'],
    // Los e2e comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
  },
});
