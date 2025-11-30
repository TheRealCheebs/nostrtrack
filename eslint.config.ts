import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'test/**',
      'coverage/**',
      'vite.config.ts',
      'eslint.config.js',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs['recommended-type-checked'],
  prettierConfig,
  importPlugin.configs.recommended,
  importPlugin.configs.typescript,
  nPlugin.configs['flat/recommended-module'],
  promisePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer short-form (e.g., string[][] vs Array<Array<string>>) for simple array types
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      // Disable base import check as we use TS extensionless imports
      'n/no-missing-import': 'off',
      // Require 'type' keyword on type imports/export statements
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      // Disallow empty functions (NB: must disable base rule for TS)
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'error',
      // Promote flatter and cleaner control flows
      'no-else-return': 'error',
      // Ignore experimental features (node: >22.4.0) that we use
      'n/no-unsupported-features/node-builtins': ['error', { ignores: ['CloseEvent'] }],
      // Ensure no node-only modules are used (as we support browsers too)
      'import/no-nodejs-modules': ['error'],
    },
    settings: {
      // Enhanced for import plugin (ensures TS paths resolve without extensions)
      'import/resolver': {
        typescript: { project: './tsconfig.json' }, // Explicitly point to tsconfig for path mappings/aliases if any
        node: true,
      },
    },
  },
];
