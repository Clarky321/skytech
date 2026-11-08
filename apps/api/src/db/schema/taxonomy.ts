import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { media } from './media.js';
import { users } from './users.js';

export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Max depth 2 (root → child), enforced by TaxonomyService. */
    parentId: uuid().references((): AnyPgColumn => categories.id, { onDelete: 'restrict' }),
    /** Globally unique so /category/{slug} and /category/{parent}/{slug} are unambiguous. */
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text().notNull().default(''),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.parentId)],
);

export const tags = pgTable('tags', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(''),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authorProfiles = pgTable('author_profiles', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .unique()
    .references(() => users.id, { onDelete: 'set null' }),
  slug: text().notNull().unique(),
  name: text().notNull(),
  jobTitle: text().notNull().default(''),
  bio: text().notNull().default(''),
  avatarMediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
