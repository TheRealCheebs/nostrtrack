import { resolve } from 'path';
import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  // Mirror tsconfig path aliases so tests can import using '@services/..' etc.
  resolve: {
    alias: {
      '@services': resolve(__dirname, 'src/services'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@tui': resolve(__dirname, 'src/tui'),
      '@nostr': resolve(__dirname, 'src/nostr'),
      '@state': resolve(__dirname, 'src/state'),
    },
  },

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
