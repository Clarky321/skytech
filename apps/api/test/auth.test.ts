import { auditLog, sessions } from '../src/db/schema/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/session.service.js';
import { hashPassword } from '../src/auth/password.js';
import {
  createTestApp,
  createUser,
  login,
  ORIGIN,
  PASSWORD,
  resetState,
  signedIn,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

describe('passwords', () => {
  it('uses Argon2id', async () => {
    expect(await hashPassword('x'.repeat(12))).toMatch(/^\$argon2id\$/);
  });
});

describe('login', () => {
  it('sets a hardened session cookie and stores only the token hash', async () => {
    const user = await createUser(ctx, 'admin');
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: '  ADMIN@test.local ', password: PASSWORD })
      .expect(200);

    expect(res.body).toMatchObject({ id: user.id, role: 'admin' });
    expect(res.body.permissions).toContain('content.publish');
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cookie).toMatch(/^skytech_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const token = cookie.split(';')[0]?.split('=')[1] ?? '';
    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashToken(token));
    expect(rows[0]?.tokenHash).not.toBe(token);
  });

  it('rejects a wrong password with a generic message and audits it', async () => {
    await createUser(ctx, 'editor');
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'editor@test.local', password: 'wrong-password' })
      .expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.detail).toBe('Неверный email или пароль');
    const audit = await ctx.db.select().from(auditLog);
    expect(audit.map((a) => a.action)).toContain('auth.login_failed');
    expect(JSON.stringify(audit)).not.toContain('wrong-password');
  });

  it('gives the same answer for an unknown email', async () => {
    const res = await ctx
      .http()
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'nobody@test.local', password: PASSWORD })
      .expect(401);
    expect(res.body.detail).toBe('Неверный email или пароль');
  });

  it('rate-limits repeated failures per email (429), even with the right password', async () => {
    await createUser(ctx, 'author');
    for (let i = 0; i < 5; i++) {
      await ctx
        .http()
        .post('/api/admin/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'author@test.local', password: `bad-${String(i)}` })
        .expect(401);
    }
    await ctx
      .http()
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'author@test.local', password: PASSWORD })
      .expect(429);
  });

  it('issues a new session on every login (no fixation)', async () => {
    await createUser(ctx, 'admin');
    const first = await login(ctx, 'admin@test.local');
    const second = await login(ctx, 'admin@test.local');
    expect(first).not.toBe(second);
  });
});

describe('sessions', () => {
  it('logout revokes the session server-side', async () => {
    const admin = await signedIn(ctx, 'admin');
    await admin.get('/api/admin/auth/me').expect(200);
    await admin.post('/api/admin/auth/logout').expect(204);
    await admin.get('/api/admin/auth/me').expect(401);
  });

  it('rejects forged and malformed cookies', async () => {
    await ctx
      .http()
      .get('/api/admin/auth/me')
      .set('Cookie', 'skytech_session=forged-token-value-123456')
      .expect(401);
    await ctx
      .http()
      .get('/api/admin/auth/me')
      .set('Cookie', 'skytech_session=<script>')
      .expect(401);
  });

  it('changing the password signs out other sessions but keeps the current one', async () => {
    const admin = await signedIn(ctx, 'admin');
    const other = await login(ctx, 'admin@test.local');
    await admin
      .post('/api/admin/auth/me/password', {
        currentPassword: PASSWORD,
        newPassword: 'another-long-password',
      })
      .expect(204);
    await admin.get('/api/admin/auth/me').expect(200);
    await ctx.http().get('/api/admin/auth/me').set('Cookie', other).expect(401);
  });
});

describe('CSRF (Origin check)', () => {
  it('rejects state-changing requests without Origin', async () => {
    const admin = await signedIn(ctx, 'admin');
    const res = await ctx
      .http()
      .post('/api/admin/content')
      .set('Cookie', admin.cookie)
      .send({ type: 'article', title: 'x' })
      .expect(403);
    expect(res.headers['x-problem-code']).toBe('csrf');
  });

  it('rejects a foreign Origin, including on the public login route', async () => {
    await createUser(ctx, 'admin');
    await ctx
      .http()
      .post('/api/admin/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'admin@test.local', password: PASSWORD })
      .expect(403);
  });

  it('allows safe methods without Origin', async () => {
    await ctx.http().get('/api/v1/articles').expect(200);
  });
});
