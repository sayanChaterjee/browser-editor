// Shared ESLint config for the backend workspaces (the frontend has its own Next.js config).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-test/**', '**/node_modules/**', 'frontend/**', 'loadtest/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // The services use `any` heavily; tightened to an error in a later session.
      '@typescript-eslint/no-explicit-any': 'warn',
      // CommonJS services read their own package.json with require().
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
);
