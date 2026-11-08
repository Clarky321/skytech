import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'editor', 'author']);

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** Always stored trimmed and lower-cased. */
  email: text().notNull().unique(),
  displayName: text().notNull(),
  passwordHash: text().notNull(),
  role: userRole().notNull(),
  isActive: boolean().notNull().default(true),
  lastLoginAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the session token. The token itself is never stored. */
    tokenHash: text().notNull().unique(),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index().on(t.userId), index().on(t.expiresAt)],
);
