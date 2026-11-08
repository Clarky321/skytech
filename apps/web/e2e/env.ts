/** Isolated end-to-end environment: own ports, database, Redis DB and bucket. */
export const E2E = {
  webPort: 3100,
  apiPort: 4100,
  webUrl: 'http://localhost:3100',
  apiUrl: 'http://localhost:4100',
  databaseUrl: 'postgres://skytech:skytech@localhost:5432/skytech_e2e',
  redisUrl: 'redis://localhost:6379/2',
  bucket: 'skytech-media-test',
  mediaUrl: 'http://localhost:9000/skytech-media-test',
  admin: { email: 'e2e-admin@skytech.local', password: 'e2e-admin-password-123' },
  author: { email: 'e2e-author@skytech.local', password: 'e2e-author-password-123' },
} as const;

export const apiEnv: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  API_PORT: String(E2E.apiPort),
  DATABASE_URL: E2E.databaseUrl,
  REDIS_URL: E2E.redisUrl,
  APP_ORIGIN: E2E.webUrl,
  COOKIE_SECURE: 'true',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: E2E.bucket,
  S3_ACCESS_KEY: 'skytech',
  S3_SECRET_KEY: 'skytech-dev-secret',
  S3_FORCE_PATH_STYLE: 'true',
  S3_PUBLIC_URL: E2E.mediaUrl,
};

export const webEnv: Record<string, string> = {
  API_INTERNAL_URL: E2E.apiUrl,
  NEXT_PUBLIC_MEDIA_URL: E2E.mediaUrl,
  NEXT_PUBLIC_SITE_URL: E2E.webUrl,
  // Separate build output so e2e never clashes with `pnpm dev` / `pnpm build`.
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_TELEMETRY_DISABLED: '1',
};
