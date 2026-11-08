import { Inject, Injectable } from '@nestjs/common';
import {
  type ArticleCard,
  type ArticleFull,
  type ArticleLookup,
  type ContentType,
  type Paginated,
  urls,
} from '@skytech/contracts';
import { and, count, desc, eq, inArray, ne, type SQL, sql } from 'drizzle-orm';
import { AuthorsService } from '../authors/authors.service.js';
import { content, contentRevisions, contentTags, redirects } from '../db/schema/index.js';
import { MediaService } from '../media/media.service.js';
import { DB, type Db } from '../platform/db.js';
import { TaxonomyService } from '../taxonomy/taxonomy.service.js';

type ContentRow = typeof content.$inferSelect;
type RevisionRow = typeof contentRevisions.$inferSelect;
export interface Published {
  content: ContentRow;
  revision: RevisionRow;
}

export function contentPath(type: ContentType, slug: string): string {
  return type === 'article' ? urls.article(slug) : urls.page(slug);
}

export interface PublishedFilter {
  categoryIds?: string[];
  tagId?: string;
  authorId?: string;
}

/**
 * Public read side: only published content, always the published revision.
 * Also maps a draft revision for the admin preview so preview == public page.
 */
@Injectable()
export class ContentQueryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly taxonomy: TaxonomyService,
    private readonly authors: AuthorsService,
    private readonly media: MediaService,
  ) {}

  async listPublished(
    page: number,
    pageSize: number,
    filter: PublishedFilter = {},
  ): Promise<Paginated<ArticleCard>> {
    const conditions: SQL[] = [eq(content.status, 'published'), eq(content.type, 'article')];
    if (filter.categoryIds) {
      if (filter.categoryIds.length === 0) return { items: [], page, pageSize, total: 0 };
      conditions.push(inArray(contentRevisions.categoryId, filter.categoryIds));
    }
    if (filter.authorId) conditions.push(eq(contentRevisions.authorId, filter.authorId));
    if (filter.tagId) {
      conditions.push(
        sql`exists (select 1 from ${contentTags} where ${contentTags.contentId} = ${content.id} and ${contentTags.tagId} = ${filter.tagId})`,
      );
    }
    const where = and(...conditions);
    const [rows, [total]] = await Promise.all([
      this.db
        .select({ content, revision: contentRevisions })
        .from(content)
        .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
        .where(where)
        .orderBy(desc(content.publishedAt), desc(content.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ value: count() })
        .from(content)
        .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
        .where(where),
    ]);
    return { items: await this.toCards(rows), page, pageSize, total: total?.value ?? 0 };
  }

  async lookup(type: ContentType, slug: string): Promise<ArticleLookup | null> {
    const [row] = await this.db
      .select({ content, revision: contentRevisions })
      .from(content)
      .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
      .where(
        and(
          eq(content.type, type),
          eq(content.status, 'published'),
          eq(content.publishedSlug, slug),
        ),
      );
    if (row) return { kind: 'article', article: await this.toFull(row, true) };

    // Old URL of a renamed material → permanent redirect.
    const [redirect] = await this.db
      .select()
      .from(redirects)
      .where(eq(redirects.fromPath, contentPath(type, slug)));
    return redirect ? { kind: 'redirect', location: redirect.toPath } : null;
  }

  /** Admin preview of any revision rendered exactly like the public page. */
  async preview(row: Published): Promise<ArticleFull> {
    return this.toFull(row, false);
  }

  private async toFull(row: Published, withRelated: boolean): Promise<ArticleFull> {
    const [card] = await this.toCards([row]);
    if (!card) throw new Error('card mapping failed');
    const author = row.revision.authorId
      ? (await this.authors.byIds([row.revision.authorId])).get(row.revision.authorId)
      : undefined;
    const category = row.revision.categoryId
      ? (await this.taxonomy.categoriesByIds([row.revision.categoryId])).get(
          row.revision.categoryId,
        )
      : undefined;
    const breadcrumbs = category
      ? [
          ...(category.parent
            ? [{ name: category.parent.name, path: urls.category([category.parent.slug]) }]
            : []),
          { name: category.name, path: category.path },
        ]
      : [];
    return {
      ...card,
      seoTitle: row.revision.seoTitle,
      seoDescription: row.revision.seoDescription,
      html: row.revision.html,
      toc: row.revision.toc,
      author: author
        ? {
            id: author.id,
            name: author.name,
            slug: author.slug,
            jobTitle: author.jobTitle,
            bio: author.bio,
          }
        : null,
      breadcrumbs,
      related: withRelated ? await this.related(row) : [],
    };
  }

  /** Published articles sharing the most tags, then the same category. */
  private async related(row: Published, limit = 3): Promise<ArticleCard[]> {
    const tagIds = row.revision.tagIds;
    const sharedTags = tagIds.length
      ? sql<number>`(select count(*) from ${contentTags} where ${contentTags.contentId} = ${content.id} and ${inArray(contentTags.tagId, tagIds)})`
      : sql<number>`0`;
    const sameCategory = row.revision.categoryId
      ? sql<number>`case when ${contentRevisions.categoryId} = ${row.revision.categoryId} then 1 else 0 end`
      : sql<number>`0`;
    const rows = await this.db
      .select({
        content,
        revision: contentRevisions,
        score: sql<number>`${sharedTags} * 2 + ${sameCategory}`,
      })
      .from(content)
      .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
      .where(
        and(
          eq(content.status, 'published'),
          eq(content.type, 'article'),
          ne(content.id, row.content.id),
          sql`${sharedTags} * 2 + ${sameCategory} > 0`,
        ),
      )
      .orderBy(desc(sql`${sharedTags} * 2 + ${sameCategory}`), desc(content.publishedAt))
      .limit(limit);
    return this.toCards(rows);
  }

  async toCards(rows: Published[]): Promise<ArticleCard[]> {
    const revs = rows.map((r) => r.revision);
    const [categories, authors, tags, covers] = await Promise.all([
      this.taxonomy.categoriesByIds(revs.map((r) => r.categoryId).filter(isString)),
      this.authors.byIds(revs.map((r) => r.authorId).filter(isString)),
      this.taxonomy.tagsByIds(revs.flatMap((r) => r.tagIds)),
      this.media.getRefs(revs.map((r) => r.coverMediaId).filter(isString)),
    ]);
    return rows.map(({ content: c, revision: r }) => {
      const category = r.categoryId ? categories.get(r.categoryId) : undefined;
      const author = r.authorId ? authors.get(r.authorId) : undefined;
      const publishedAt = (c.publishedAt ?? c.updatedAt).toISOString();
      return {
        id: c.id,
        type: c.type,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt || summarize(r.plainText),
        publishedAt,
        updatedContentAt: (c.updatedContentAt ?? c.publishedAt ?? c.updatedAt).toISOString(),
        readingTimeMinutes: r.readingTimeMinutes,
        category: category
          ? { id: category.id, name: category.name, slug: category.slug, path: category.path }
          : null,
        author: author ? { id: author.id, name: author.name, slug: author.slug } : null,
        tags: r.tagIds
          .map((id) => tags.get(id))
          .filter((t) => t !== undefined)
          .map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
        cover: r.coverMediaId ? (covers.get(r.coverMediaId) ?? null) : null,
      };
    });
  }
}

function isString(value: string | null): value is string {
  return value !== null;
}

/** First ~200 characters of the text, cut at a word boundary. */
export function summarize(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}
