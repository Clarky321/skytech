import type { MediaVariant } from '@skytech/contracts';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const media = pgTable('media', {
  id: uuid().primaryKey().defaultRandom(),
  originalName: text().notNull(),
  /** MIME detected from the file signature (not the client-declared type). */
  mime: text().notNull(),
  size: integer().notNull(),
  /** SHA-256 of the uploaded bytes; identical uploads are deduplicated. */
  sha256: text().notNull().unique(),
  width: integer().notNull(),
  height: integer().notNull(),
  alt: text().notNull().default(''),
  full: jsonb().$type<MediaVariant>().notNull(),
  variants: jsonb().$type<MediaVariant[]>().notNull().default([]),
  createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
