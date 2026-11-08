import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // Monorepo root, so Turbopack resolves workspace packages and the single lockfile.
    root: path.resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
