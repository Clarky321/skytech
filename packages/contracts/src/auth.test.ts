import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSIONS, ROLES, type Permission, type Role } from './auth.js';

// The expected matrix is written out explicitly so that any change to PERMISSIONS
// shows up as a deliberate test change in review.
const EXPECTED: Record<Permission, Role[]> = {
  'content.create': ['admin', 'editor', 'author'],
  'content.edit_own': ['admin', 'editor', 'author'],
  'content.edit_any': ['admin', 'editor'],
  'content.submit': ['admin', 'editor', 'author'],
  'content.publish': ['admin', 'editor'],
  'taxonomy.manage': ['admin', 'editor'],
  'authors.manage': ['admin', 'editor'],
  'media.upload': ['admin', 'editor', 'author'],
  'media.delete': ['admin', 'editor'],
  'users.manage': ['admin'],
  'audit.read': ['admin'],
};

describe('permission matrix', () => {
  it('covers exactly the expected permissions', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const permission of Object.keys(EXPECTED) as Permission[]) {
    for (const role of ROLES) {
      const allowed = EXPECTED[permission].includes(role);
      it(`${role} ${allowed ? 'can' : 'cannot'} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(allowed);
      });
    }
  }

  it('authors can never publish', () => {
    expect(hasPermission('author', 'content.publish')).toBe(false);
  });
});
