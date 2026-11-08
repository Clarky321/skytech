import { defineConfig, devices } from '@playwright/test';
import { apiEnv, E2E, webEnv } from './e2e/env';

/**
 * End-to-end tests of the authoring flow on an isolated stack.
 * Needs `pnpm infra:up` (PostgreSQL, Redis, MinIO) and a built API (`pnpm e2e` does both builds).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: E2E.webUrl,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'node e2e/prepare-db.mjs && node ../api/dist/main.js',
      url: `${E2E.apiUrl}/api/health/ready`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm exec next build && pnpm exec next start --port 3100',
      url: E2E.webUrl,
      env: webEnv,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
