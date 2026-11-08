import { describe, expect, it } from 'vitest';

// Toolchain smoke test: the package compiles and its entry point resolves as ESM.
// Boundary tests for each tool arrive with the tools themselves in Phase 9.1.
describe('@skytech/tools-core', () => {
  it('entry point loads', async () => {
    const mod: unknown = await import('./index.js');
    expect(mod).toBeTypeOf('object');
  });
});
