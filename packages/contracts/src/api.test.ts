import { describe, expect, it } from 'vitest';
import { ADMIN_API_PREFIX, API_ROOT, PUBLIC_API_PREFIX } from './index.js';

describe('API prefixes', () => {
  it('match the URL policy from the architecture', () => {
    expect(API_ROOT).toBe('api');
    expect(PUBLIC_API_PREFIX).toBe('/api/v1');
    expect(ADMIN_API_PREFIX).toBe('/api/admin');
  });
});
