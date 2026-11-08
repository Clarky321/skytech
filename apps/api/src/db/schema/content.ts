import type { SkyDocument, TocItem } from '@skytech/contracts';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { media } from './media.js';
import { tags } from './taxonomy.js';
import { users } from './users.js';

export const contentType = pgEnum('content_type', ['article', 'page']);
export const contentStatus = pgEnum('content_status', [
  'draft',
  'review',
  'scheduled',
  'published',
  'archived',
]);

/**
 * One row per material. Editable state lives in immutable revisions:
 * `draftRevisionId` is what the editor shows, `publishedRevisionId` is what the site shows.
 */
export const content = pgTable(
  'content',
  {
    id: uuid().primaryKey().defaultRandom(),
    type: contentType().notNull(),
    status: contentStatus().notNull().default('draft'),
    /** Slug of the current draft (unique per type, so drafts cannot collide either). */
    slug: text().notNull(),
    /** Slug currently live on the site; null when not published. */
    publishedSlug: text(),
    /** Optimistic lock, incremented on every change. */
    version: integer().notNull().default(1),
    draftRevisionId: uuid().references((): AnyPgColumn => contentRevisions.id),
    publishedRevisionId: uuid().references((): AnyPgColumn => contentRevisions.id),
    /** First publication time. */
    publishedAt: timestamp({ withTimezone: true }),
    /** Last time a new revision went live. */
    updatedContentAt: timestamp({ withTimezone: true }),
    scheduledAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('content_type_slug_uq').on(t.type, t.slug),
    uniqueIndex('content_type_published_slug_uq')
      .on(t.type, t.publishedSlug)
      .where(sql`${t.publishedSlug} is not null`),
    index().on(t.status, t.type, t.publishedAt),
    index()
      .on(t.scheduledAt)
      .where(sql`${t.status} = 'scheduled'`),
  ],
);

/**
 * Immutable snapshot of a material. Taxonomy/author/cover references are plain ids (no FK):
 * a revision is history and must not change when a category or tag is later removed.
 */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: uuid().primaryKey().defaultRandom(),
    contentId: uuid()
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    slug: text().notNull(),
    excerpt: text().notNull().default(''),
    body: jsonb().$type<SkyDocument>().notNull(),
    bodySchemaVersion: integer().notNull(),
    categoryId: uuid(),
    tagIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    authorId: uuid(),
    coverMediaId: uuid(),
    seoTitle: text().notNull().default(''),
    seoDescription: text().notNull().default(''),
    // Derived at save time by @skytech/content-render (never edited directly).
    html: text().notNull(),
    toc: jsonb().$type<TocItem[]>().notNull(),
    plainText: text().notNull(),
    wordCount: integer().notNull(),
    readingTimeMinutes: integer().notNull(),
    note: text().notNull().default(''),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.contentId, t.createdAt)],
);

/** Tags of the *published* revision, for public tag listings. */
export const contentTags = pgTable(
  'content_tags',
  {
    contentId: uuid()
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    tagId: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.tagId] }), index().on(t.tagId)],
);

/** Media referenced by a revision (body images + cover). Blocks deleting media still in use. */
export const revisionMedia = pgTable(
  'revision_media',
  {
    revisionId: uuid()
      .notNull()
      .references(() => contentRevisions.id, { onDelete: 'cascade' }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.revisionId, t.mediaId] }), index().on(t.mediaId)],
);

export const redirects = pgTable('redirects', {
  id: uuid().primaryKey().defaultRandom(),
  fromPath: text().notNull().unique(),
  toPath: text().notNull(),
  statusCode: integer().notNull().default(301),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
