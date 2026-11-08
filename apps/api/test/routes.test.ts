import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, ORIGIN, type TestContext } from './helpers.js';

/**
 * Deny-by-default guard: walks every registered route and checks that, without a session,
 * it answers 401 — except the explicit allow-list of public routes below.
 * A new route that forgets authentication fails this test.
 */
const PUBLIC_ROUTES = new Set([
  'GET /api/health/live',
  'GET /api/health/ready',
  'POST /api/admin/auth/login',
  'POST /api/admin/auth/logout',
  'GET /api/v1/categories',
  'GET /api/v1/categories/:slug',
  'GET /api/v1/tags/:slug',
  'GET /api/v1/authors/:slug',
  'GET /api/v1/articles',
  'GET /api/v1/articles/:slug',
  'GET /api/v1/pages/:slug',
]);

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
}

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

function routes(): { method: string; path: string }[] {
  const express = ctx.app.getHttpAdapter().getInstance() as { router: { stack: Layer[] } };
  return (
    express.router.stack
      // Skip Nest's own catch-all not-found handler registered under the global prefix.
      .filter(
        (layer): layer is Required<Layer> =>
          Boolean(layer.route) && !layer.route?.path.includes('*'),
      )
      .flatMap((layer) =>
        Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .filter((m) => HTTP_METHODS.has(m))
          .map((method) => ({ method, path: layer.route.path })),
      )
  );
}

describe('route protection', () => {
  it('finds the application routes', () => {
    expect(routes().length).toBeGreaterThan(30);
  });

  it('every non-public route requires a session', async () => {
    const unexpected: string[] = [];
    for (const { method, path } of routes()) {
      const key = `${method} ${path}`;
      if (PUBLIC_ROUTES.has(key)) continue;
      const url = path.replace(/:(\w+)/g, (_, name: string) =>
        name.toLowerCase().includes('id') ? '00000000-0000-4000-8000-000000000000' : 'sample',
      );
      const res = await ctx
        .http()
        [method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](url)
        .set('Origin', ORIGIN);
      if (res.status !== 401) unexpected.push(`${key} → ${String(res.status)}`);
    }
    expect(unexpected).toEqual([]);
  });

  it('every public route in the allow-list exists', () => {
    const existing = new Set(routes().map((r) => `${r.method} ${r.path}`));
    expect([...PUBLIC_ROUTES].filter((r) => !existing.has(r))).toEqual([]);
  });
});
