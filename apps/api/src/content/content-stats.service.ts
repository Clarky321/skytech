import { Inject, Injectable, Module } from '@nestjs/common';
import { and, count, eq, or, type SQL, sql } from 'drizzle-orm';
import { content, contentRevisions, contentTags } from '../db/schema/index.js';
import { DB, type Db } from '../platform/db.js';

/**
 * Read-only questions other modules ask about content (counts, usage checks).
 * Lives in the content domain so taxonomy/authors never query content tables directly,
 * and has no dependencies so it does not create module cycles.
 */
@Injectable()
export class ContentStatsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Published articles per category of their published revision. */
  async publishedArticlesByCategory(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ id: contentRevisions.categoryId, value: count() })
      .from(content)
      .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
      .where(and(eq(content.status, 'published'), eq(content.type, 'article')))
      .groupBy(contentRevisions.categoryId);
    return toMap(rows);
  }

  async publishedArticlesByTag(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ id: contentTags.tagId, value: count() })
      .from(contentTags)
      .innerJoin(content, eq(content.id, contentTags.contentId))
      .where(and(eq(content.status, 'published'), eq(content.type, 'article')))
      .groupBy(contentTags.tagId);
    return toMap(rows);
  }

  async publishedArticlesByAuthor(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ id: contentRevisions.authorId, value: count() })
      .from(content)
      .innerJoin(contentRevisions, eq(contentRevisions.id, content.publishedRevisionId))
      .where(and(eq(content.status, 'published'), eq(content.type, 'article')))
      .groupBy(contentRevisions.authorId);
    return toMap(rows);
  }

  /** True if the current draft or the published revision of any material references it. */
  async isCategoryInUse(categoryId: string): Promise<boolean> {
    return this.currentRevisionsMatch(eq(contentRevisions.categoryId, categoryId));
  }

  async isTagInUse(tagId: string): Promise<boolean> {
    return this.currentRevisionsMatch(sql`${tagId}::uuid = any(${contentRevisions.tagIds})`);
  }

  async isAuthorInUse(authorId: string): Promise<boolean> {
    return this.currentRevisionsMatch(eq(contentRevisions.authorId, authorId));
  }

  private async currentRevisionsMatch(condition: SQL): Promise<boolean> {
    const [row] = await this.db
      .select({ id: content.id })
      .from(content)
      .innerJoin(
        contentRevisions,
        or(
          eq(contentRevisions.id, content.draftRevisionId),
          eq(contentRevisions.id, content.publishedRevisionId),
        ),
      )
      .where(condition)
      .limit(1);
    return Boolean(row);
  }
}

function toMap(rows: { id: string | null; value: number }[]): Map<string, number> {
  return new Map(rows.filter((r) => r.id !== null).map((r) => [r.id as string, r.value]));
}

@Module({
  providers: [ContentStatsService],
  exports: [ContentStatsService],
})
export class ContentStatsModule {}
