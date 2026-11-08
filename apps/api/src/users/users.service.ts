import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@skytech/contracts';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { sessions, users } from '../db/schema/index.js';
import { DB, type Db, type DbOrTx } from '../platform/db.js';

export type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findByEmail(email: string, tx: DbOrTx = this.db): Promise<UserRow | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)));
    return row;
  }

  async findById(id: string, tx: DbOrTx = this.db): Promise<UserRow | undefined> {
    const [row] = await tx.select().from(users).where(eq(users.id, id));
    return row;
  }

  async findNames(ids: string[], tx: DbOrTx = this.db): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await tx
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.id, r.displayName]));
  }

  async create(
    tx: DbOrTx,
    input: { email: string; displayName: string; role: Role; passwordHash: string },
  ): Promise<UserRow> {
    const [row] = await tx
      .insert(users)
      .values({ ...input, email: normalizeEmail(input.email) })
      .returning();
    if (!row) throw new Error('user insert returned no row');
    return row;
  }

  async updateDisplayName(tx: DbOrTx, id: string, displayName: string): Promise<void> {
    await tx.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.id, id));
  }

  async markLogin(tx: DbOrTx, id: string): Promise<void> {
    await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  /** Sets a new password hash and signs the user out everywhere except `keepSessionId`. */
  async setPasswordHash(
    tx: DbOrTx,
    id: string,
    passwordHash: string,
    keepSessionId?: string,
  ): Promise<void> {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    await tx
      .delete(sessions)
      .where(
        keepSessionId
          ? and(eq(sessions.userId, id), ne(sessions.id, keepSessionId))
          : eq(sessions.userId, id),
      );
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
