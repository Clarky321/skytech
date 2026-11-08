// Config for the Next.js app (public site + /admin).
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

/** @param {string} tsconfigRootDir */
export function next(tsconfigRootDir) {
  return tseslint.config(...nextCoreWebVitals, ...nextTypescript, ...base(tsconfigRootDir), {
    languageOptions: { globals: { ...globals.browser } },
  });
}
