import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['./testing/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // type-only declaration files (no runtime statements to cover)
      exclude: ['src/tests/**', 'src/ast.ts', 'src/types.ts'],
      reportsDirectory: './coverage',
    },
  },
});
