import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// Local runs read the repository root .env; CI and production pass DATABASE_URL directly.
if (!process.env.DATABASE_URL && existsSync('../../.env')) process.loadEnvFile('../../.env');

// Only `drizzle-kit generate` and `drizzle-kit migrate` are allowed (never `push`, ADR 0001).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
