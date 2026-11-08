import { z } from 'zod';
import { pageQuerySchema, slugSchema } from './common.js';
import { documentInputSchema, type SkyDocument } from './document.js';

export const CONTENT_TYPES = ['article', 'page'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Черновик',
  review: 'На проверке',
  scheduled: 'Запланировано',
  published: 'Опубликовано',
  archived: 'В архиве',
};

export const CONTENT_ACTIONS = [
  'edit',
  'submit',
  'publish',
  'schedule',
  'unpublish',
  'archive',
  'restore',
] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

/** Top-level slugs that a `page` cannot take because the site already routes them. */
export const RESERVED_PAGE_SLUGS = [
  'admin',
  'api',
  'articles',
  'category',
  'tags',
  'authors',
  'tools',
  'search',
  'rss',
  'sitemap',
  'robots',
  'media',
  'static',
  '_next',
] as const;

export const contentListQuerySchema = pageQuerySchema.extend({
  type: z.enum(CONTENT_TYPES).default('article'),
  status: z.enum(CONTENT_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
});
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

export const createContentSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().max(200).default(''),
});
export type CreateContentInput = z.infer<typeof createContentSchema>;

/** Full editable state of a draft. Every save creates a new immutable revision. */
export const contentDraftSchema = z.object({
  title: z.string().trim().max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(500).default(''),
  body: documentInputSchema,
  categoryId: z.uuid().nullable().default(null),
  tagIds: z.array(z.uuid()).max(20).default([]),
  authorId: z.uuid().nullable().default(null),
  coverMediaId: z.uuid().nullable().default(null),
  seoTitle: z.string().trim().max(200).default(''),
  seoDescription: z.string().trim().max(320).default(''),
});
export type ContentDraftInput = z.input<typeof contentDraftSchema>;
export type ContentDraft = z.output<typeof contentDraftSchema>;

export const saveDraftSchema = contentDraftSchema.extend({
  /** Optimistic lock: the version the client edited. Mismatch → 409. */
  version: z.number().int().min(1),
  /** Optional note shown in the revision history. */
  note: z.string().trim().max(200).default(''),
});
export type SaveDraftInput = z.input<typeof saveDraftSchema>;

export const versionedActionSchema = z.object({ version: z.number().int().min(1) });
export type VersionedActionInput = z.infer<typeof versionedActionSchema>;

export const scheduleSchema = versionedActionSchema.extend({
  scheduledAt: z.iso.datetime({ offset: true }),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const renderPreviewSchema = z.object({ body: documentInputSchema });

export interface TocItem {
  id: string;
  text: string;
  /** Editor heading level (1–4); rendered as h2–h5. */
  level: number;
}

export interface RenderedBody {
  html: string;
  toc: TocItem[];
  readingTimeMinutes: number;
  wordCount: number;
}

export interface ContentPersonRef {
  id: string;
  name: string;
}

export interface AdminContentListItem {
  id: string;
  type: ContentType;
  status: ContentStatus;
  title: string;
  slug: string;
  author: ContentPersonRef | null;
  category: { id: string; name: string } | null;
  hasUnpublishedChanges: boolean;
  createdBy: ContentPersonRef | null;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface AdminContentDetail {
  id: string;
  type: ContentType;
  status: ContentStatus;
  version: number;
  draft: ContentDraft;
  draftRevisionId: string;
  publishedRevisionId: string | null;
  /** Slug currently live on the site (may differ from the draft slug). */
  publishedSlug: string | null;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  createdBy: ContentPersonRef | null;
  /** Server-computed for the current user; UI only mirrors it. */
  allowedActions: ContentAction[];
  /** Problems that block publishing (empty when publishable). */
  publishIssues: string[];
}

export interface RevisionSummary {
  id: string;
  createdAt: string;
  createdBy: ContentPersonRef | null;
  title: string;
  note: string;
  isDraft: boolean;
  isPublished: boolean;
}

export interface MediaRef {
  id: string;
  alt: string;
  width: number;
  height: number;
  /** `srcset`-ready renditions, ascending. */
  sources: { url: string; width: number }[];
  url: string;
}

export interface ArticleCard {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  updatedContentAt: string;
  readingTimeMinutes: number;
  category: { id: string; name: string; slug: string; path: string } | null;
  author: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
  cover: MediaRef | null;
}

export interface ArticleFull extends ArticleCard {
  seoTitle: string;
  seoDescription: string;
  html: string;
  toc: TocItem[];
  author: { id: string; name: string; slug: string; jobTitle: string; bio: string } | null;
  /** Category chain for breadcrumbs, root first. */
  breadcrumbs: { name: string; path: string }[];
  related: ArticleCard[];
}

/** Public detail lookup: either the article or a permanent redirect to its new slug. */
export type ArticleLookup =
  { kind: 'article'; article: ArticleFull } | { kind: 'redirect'; location: string };

export type { SkyDocument };
