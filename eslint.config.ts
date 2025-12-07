import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'test/**',
      'coverage/**',
      'lib/**',
      '*.d.ts',
      'vite.config.ts',
      'eslint.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  nPlugin.configs['flat/recommended-module'],
  promisePlugin.configs['flat/recommended'],
  // Gradually enable strict rules as your project matures
  // ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-else-return': 'error', // Enforce early returns and flat code
      'no-lonely-if': 'error', // Prevent if statements that could be early returns
      'max-depth': ['error', 3], // Limit nesting depth
      complexity: ['error', 10], // Limit cyclomatic complexity

      // TypeScript-specific rules for type safety and consistency
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',

      // Modern JavaScript/TypeScript features
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'error',

      // Import organization and quality
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/no-cycle': 'error',
      'import/no-nodejs-modules': ['error'],

      // Promise handling
      '@typescript-eslint/no-floating-promises': 'error',
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',

      // Node.js compatibility
      'n/no-missing-import': 'off', // Handled by TypeScript
      'n/no-unsupported-features/node-builtins': ['error', { ignores: ['CloseEvent'] }],

      // Code structure and maintainability
      'max-lines-per-function': ['error', 50],
      'max-params': ['error', 4],
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
  },
);
