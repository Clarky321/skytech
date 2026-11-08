import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type AppConfig, loadConfig } from '../src/platform/config.js';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Integration tests run against real PostgreSQL / Redis / MinIO from docker/compose.dev.yml,
 * but on dedicated resources: skytech_test database, Redis DB 1, the -test bucket.
 */
export function testConfig(): AppConfig {
  const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  redis.pathname = '/1';
  return loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ?? 'postgres://skytech:skytech@localhost:5432/skytech_test',
    REDIS_URL: redis.toString(),
    S3_BUCKET: process.env.TEST_S3_BUCKET ?? 'skytech-media-test',
    S3_PUBLIC_URL: (process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/skytech-media').replace(
      /skytech-media$/,
      process.env.TEST_S3_BUCKET ?? 'skytech-media-test',
    ),
  });
}
