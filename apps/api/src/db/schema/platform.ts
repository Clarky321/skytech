import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    /** Meaningful changes only; never passwords, tokens or cookies. */
    diff: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entityType, t.entityId), index().on(t.createdAt)],
);

/** Transactional outbox: side effects are recorded in the same transaction as the change. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index()
      .on(t.createdAt)
      .where(sql`${t.processedAt} is null`),
  ],
);
