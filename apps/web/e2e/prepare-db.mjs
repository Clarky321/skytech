// Prepares the e2e database through the real CLI (same code paths as production):
// reset schema + migrations, create an admin and an author, seed taxonomy and articles.
// Runs inside Playwright's API webServer command, so it always finishes before the API starts.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../api/dist/cli.js', import.meta.url));

function run(args, input) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout);
}

const admin = { email: 'e2e-admin@skytech.local', password: 'e2e-admin-password-123' };
const author = { email: 'e2e-author@skytech.local', password: 'e2e-author-password-123' };

run(['db:reset']);
run(
  [
    'user:create',
    '--email',
    admin.email,
    '--name',
    'E2E Admin',
    '--role',
    'admin',
    '--password-stdin',
  ],
  admin.password,
);
run(
  [
    'user:create',
    '--email',
    author.email,
    '--name',
    'E2E Author',
    '--role',
    'author',
    '--password-stdin',
  ],
  author.password,
);
run(['db:seed']);
