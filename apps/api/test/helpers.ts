import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Role } from '@skytech/contracts';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { configureApp } from '../src/configure-app.js';
import { DB, type Db } from '../src/platform/db.js';
import { REDIS } from '../src/platform/platform.module.js';
import { UsersService } from '../src/users/users.service.js';
import { testConfig } from './env.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct-horse-battery-staple';

export interface TestContext {
  app: NestExpressApplication;
  db: Db;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(testConfig())],
  }).compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    }),
  );
  await app.init();
  return {
    app,
    db: app.get<Db>(DB),
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

/** Empties every table (fast, keeps the schema) and clears rate-limit counters. */
export async function resetState(ctx: TestContext): Promise<void> {
  await ctx.db.execute(sql`
    truncate table audit_log, outbox_events, revision_media, content_tags, redirects,
      content_revisions, content, author_profiles, categories, tags, media, sessions, users
    restart identity cascade
  `);
  await ctx.app.get<Redis>(REDIS).flushdb();
}

export async function createUser(ctx: TestContext, role: Role, email = `${role}@test.local`) {
  return ctx.app.get(UsersService).create(ctx.db, {
    email,
    displayName: `${role} user`,
    role,
    passwordHash: await hashPassword(PASSWORD),
  });
}

/** Logs in through the real endpoint and returns the Cookie header for later requests. */
export async function login(ctx: TestContext, email: string, password = PASSWORD): Promise<string> {
  const res = await ctx
    .http()
    .post('/api/admin/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password })
    .expect(200);
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = setCookie?.find((c) => c.startsWith('skytech_session='));
  if (!cookie) throw new Error('login did not set a session cookie');
  return cookie.split(';')[0] ?? '';
}

/** Creates a user with `role` and returns an authenticated agent-like helper. */
export async function signedIn(ctx: TestContext, role: Role, email?: string) {
  const user = await createUser(ctx, role, email);
  const cookie = await login(ctx, user.email);
  const withAuth = <T extends request.Test>(req: T) =>
    req.set('Cookie', cookie).set('Origin', ORIGIN);
  return {
    user,
    cookie,
    get: (url: string) => withAuth(ctx.http().get(url)),
    post: (url: string, body?: object) => withAuth(ctx.http().post(url)).send(body ?? {}),
    put: (url: string, body?: object) => withAuth(ctx.http().put(url)).send(body ?? {}),
    patch: (url: string, body?: object) => withAuth(ctx.http().patch(url)).send(body ?? {}),
    delete: (url: string) => withAuth(ctx.http().delete(url)),
    upload: (buffer: Buffer, filename: string) =>
      withAuth(ctx.http().post('/api/admin/media')).attach('file', buffer, filename),
  };
}
export type Session = Awaited<ReturnType<typeof signedIn>>;
