import './load-env.js';
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PASSWORD_MIN_LENGTH, roleSchema } from '@skytech/contracts';
import { AuditModule } from './audit/audit.module.js';
import { AuditService } from './audit/audit.service.js';
import { generatePassword, hashPassword } from './auth/password.js';
import { ContentModule } from './content/content.module.js';
import { resetDatabase } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { DB, type Db } from './platform/db.js';
import { loadConfig } from './platform/config.js';
import { PlatformModule } from './platform/platform.module.js';
import { UsersModule } from './users/users.module.js';
import { normalizeEmail, UsersService } from './users/users.service.js';

const USAGE = `SkyTech CLI

  user:create  --email <email> --name <name> --role <admin|editor|author> [--password-stdin]
  user:reset-password --email <email> [--password-stdin]
  db:reset     DEV ONLY: drop all tables and re-apply migrations
  db:seed      categories, tags, an editorial author and sample articles (needs an admin)

Without --password-stdin a strong password is generated and printed once.
Example (PowerShell):  pnpm user:create --email admin@skytech.ru --name "Админ" --role admin`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function resolvePassword(
  fromStdin: boolean,
): Promise<{ password: string; generated: boolean }> {
  if (!fromStdin) return { password: generatePassword(), generated: true };
  const password = await readStdin();
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`);
  }
  return { password, generated: false };
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
      'password-stdin': { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const config = loadConfig();
  @Module({
    imports: [PlatformModule.forRoot({ config }), AuditModule, UsersModule, ContentModule],
  })
  class CliModule {}
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });

  try {
    const db = app.get<Db>(DB);
    const users = app.get(UsersService);
    const audit = app.get(AuditService);

    switch (command) {
      case 'user:create': {
        if (!values.email || !values.name || !values.role) throw new Error(USAGE);
        const role = roleSchema.parse(values.role);
        const email = normalizeEmail(values.email);
        if (await users.findByEmail(email)) throw new Error(`User ${email} already exists`);
        const { password, generated } = await resolvePassword(values['password-stdin']);
        const passwordHash = await hashPassword(password);
        const user = await db.transaction(async (tx) => {
          const created = await users.create(tx, {
            email,
            displayName: values.name ?? email,
            role,
            passwordHash,
          });
          await audit.record(tx, {
            actorUserId: null,
            action: 'user.create',
            entityType: 'user',
            entityId: created.id,
            diff: { email, role, via: 'cli' },
          });
          return created;
        });
        process.stdout.write(`Created ${role} ${user.email}\n`);
        if (generated) process.stdout.write(`Password (shown once): ${password}\n`);
        break;
      }
      case 'user:reset-password': {
        if (!values.email) throw new Error(USAGE);
        const user = await users.findByEmail(values.email);
        if (!user) throw new Error(`User ${values.email} not found`);
        const { password, generated } = await resolvePassword(values['password-stdin']);
        const passwordHash = await hashPassword(password);
        await db.transaction(async (tx) => {
          await users.setPasswordHash(tx, user.id, passwordHash);
          await audit.record(tx, {
            actorUserId: null,
            action: 'user.password_reset',
            entityType: 'user',
            entityId: user.id,
            diff: { via: 'cli' },
          });
        });
        process.stdout.write(`Password reset for ${user.email}; all sessions signed out\n`);
        if (generated) process.stdout.write(`New password (shown once): ${password}\n`);
        break;
      }
      case 'db:reset': {
        if (config.NODE_ENV === 'production') throw new Error('db:reset is disabled in production');
        await resetDatabase(db);
        process.stdout.write('Database recreated and migrations applied\n');
        break;
      }
      case 'db:seed': {
        const summary = await seedDatabase(app);
        process.stdout.write(`${summary}\n`);
        break;
      }
      default:
        throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
