// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.cjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
  {
    // Dev-only QA scripts: plain Node ESM that also ships snippets evaluated in the browser page.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        URL: 'readonly', Buffer: 'readonly',
        document: 'readonly', window: 'readonly', history: 'readonly', dispatchEvent: 'readonly',
        PopStateEvent: 'readonly', location: 'readonly', localStorage: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
);
