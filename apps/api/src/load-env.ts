import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Local development reads the repository-root `.env` (apps/api/dist|src → ../../../.env).
// Production gets real environment variables and never loads a file.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'production' && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
