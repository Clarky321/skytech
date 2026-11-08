-- Runs once, when the postgres volume is first created.
-- skytech       — development database (POSTGRES_DB)
-- skytech_test  — integration tests (Vitest), truncated between tests
-- skytech_e2e   — Playwright end-to-end tests, recreated by the e2e global setup
CREATE DATABASE skytech_test OWNER skytech;
CREATE DATABASE skytech_e2e OWNER skytech;
