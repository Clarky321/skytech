// Base config for every TypeScript package: type-aware rules + Prettier compatibility.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/** @param {string} tsconfigRootDir absolute path of the package (pass import.meta.dirname) */
export function base(tsconfigRootDir) {
  return tseslint.config(
    { ignores: ['dist/**', '.next/**', 'coverage/**', '.turbo/**', 'next-env.d.ts'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
      },
    },
    {
      // Config files (eslint/vitest/next) are plain JS or outside the TS project.
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    prettier,
  );
}
