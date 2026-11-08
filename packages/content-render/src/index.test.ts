import { describe, expect, it } from 'vitest';

// Toolchain smoke test: the package compiles and its entry point resolves as ESM.
// Real renderer tests (including XSS cases) arrive with the pipeline in Phase 4.2.
describe('@skytech/content-render', () => {
  it('entry point loads', async () => {
    const mod: unknown = await import('./index.js');
    expect(mod).toBeTypeOf('object');
  });
});
