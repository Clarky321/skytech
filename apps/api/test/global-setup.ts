import { resetDatabase } from '../src/db/migrate.js';
import { createDb, createPool } from '../src/platform/db.js';
import { testConfig } from './env.js';

/** Once per test run: recreate the test database schema from the versioned migrations. */
export default async function setup(): Promise<void> {
  const config = testConfig();
  const pool = createPool(config.DATABASE_URL);
  try {
    await resetDatabase(createDb(pool));
  } finally {
    await pool.end();
  }
}
