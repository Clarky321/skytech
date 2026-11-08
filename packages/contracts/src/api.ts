/**
 * API URL prefixes. nginx routes everything under `/api` to the NestJS app,
 * the rest goes to Next.js (same origin, see docs/adr/0001-architecture.md).
 */
export const API_ROOT = 'api';

/** Public, read-mostly API consumed by the website. */
export const PUBLIC_API_PREFIX = `/${API_ROOT}/v1`;

/** Staff-only API consumed by /admin. Deny-by-default (Phase 3). */
export const ADMIN_API_PREFIX = `/${API_ROOT}/admin`;
