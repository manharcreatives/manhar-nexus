// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

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
    // Accessibility lint for the web app (recommended rules). Findings that need design decisions are warnings.
    files: ['apps/web/src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...Object.fromEntries(Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(([k, v]) => [k, Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn'])),
      // Deprecated rule that wants BOTH nesting and htmlFor; a label with htmlFor is correct.
      'jsx-a11y/label-has-for': 'off',
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
  {
    // Vercel's Node runtime loads this as CommonJS.
    files: ['api/**/*.js'],
    languageOptions: {
      globals: { require: 'readonly', module: 'readonly', console: 'readonly' },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
