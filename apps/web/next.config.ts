import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Local development reads the repository-root .env; production passes real env variables.
const rootEnv = path.resolve(import.meta.dirname, '../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // e2e builds into its own folder so it never clashes with `pnpm dev` / `pnpm build`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // Monorepo root, so Turbopack resolves workspace packages and the single lockfile.
    root: path.resolve(import.meta.dirname, '../..'),
  },
  // Same origin for the browser (ADR 0001): in production nginx routes /api to NestJS;
  // in development this rewrite does the same, so cookies and the CSRF Origin check match.
  rewrites() {
    return Promise.resolve([
      { source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` },
    ]);
  },
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]);
  },
};

export default nextConfig;
