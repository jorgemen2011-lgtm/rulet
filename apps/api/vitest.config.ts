import { defineConfig } from 'vitest/config';
import { unitTestEnv } from './test/test-env.js';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: unitTestEnv,
  },
});
