import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { and, eq, gt, lt } from 'drizzle-orm';
import { sessions, users } from '../db/schema/index.js';
import { APP_CONFIG, type AppConfig } from '../platform/config.js';
import { DB, type Db, type DbOrTx } from '../platform/db.js';
import type { AuthUser } from './decorators.js';

export const SESSION_COOKIE = 'skytech_session';
/** Refresh `last_seen_at` at most this often to avoid a write per request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get ttlMs(): number {
    return this.config.SESSION_TTL_HOURS * 3600 * 1000;
  }

  /** Creates a fresh session (new random token on every login → no session fixation). */
  async create(
    tx: DbOrTx,
    userId: string,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const [row] = await tx
      .insert(sessions)
      .values({
        userId,
        tokenHash: hashToken(token),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        expiresAt,
      })
      .returning({ id: sessions.id });
    if (!row) throw new Error('session insert returned no row');
    return { token, sessionId: row.id, expiresAt };
  }

  /** Resolves a cookie token to an active user, or null (unknown, expired, user disabled). */
  async resolve(token: string): Promise<AuthUser | null> {
    if (!/^[\w-]{20,100}$/.test(token)) return null;
    const now = new Date();
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        lastSeenAt: sessions.lastSeenAt,
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, now),
          eq(users.isActive, true),
        ),
      );
    if (!row) return null;
    if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId));
    }
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      sessionId: row.sessionId,
    };
  }

  async revoke(tx: DbOrTx, sessionId: string): Promise<void> {
    await tx.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async purgeExpired(): Promise<number> {
    const deleted = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()))
      .returning({ id: sessions.id });
    return deleted.length;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
