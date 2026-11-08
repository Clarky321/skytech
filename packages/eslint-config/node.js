// Config for Node.js code (NestJS app, server-only packages).
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

/** @param {string} tsconfigRootDir */
export function node(tsconfigRootDir) {
  return tseslint.config(...base(tsconfigRootDir), {
    languageOptions: { globals: { ...globals.node } },
  });
}

/**
 * NestJS-specific adjustments.
 * Constructor-injected classes must be value imports so decorator metadata keeps them,
 * so `consistent-type-imports` is disabled for the API app.
 * @param {string} tsconfigRootDir
 */
export function nest(tsconfigRootDir) {
  return tseslint.config(...node(tsconfigRootDir), {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  });
}
