import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Los e2e comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
  },
});
