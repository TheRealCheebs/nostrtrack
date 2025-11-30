import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // common test filename patterns and the test/ directory
    include: [
      'test/**/*.test.{ts,tsx,js,jsx}',
      'test/**/*.spec.{ts,tsx,js,jsx}',
      'test/**/*.ts',
      'test/**/*.js',
    ],
    // preserve vitest defaults and add any extra excludes if needed
    exclude: [...configDefaults.exclude],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
