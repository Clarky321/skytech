import { Inject, Injectable } from '@nestjs/common';
import type { Author, AuthorInput } from '@skytech/contracts';
import { asc, eq, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { ContentStatsService } from '../content/content-stats.service.js';
import { authorProfiles } from '../db/schema/index.js';
import { DB, type Db, type DbOrTx, PG_UNIQUE_VIOLATION, pgErrorCode } from '../platform/db.js';
import { conflict, notFound } from '../platform/problem.js';
import { changes } from '../taxonomy/taxonomy.service.js';

type AuthorRow = typeof authorProfiles.$inferSelect;

@Injectable()
export class AuthorsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly stats: ContentStatsService,
  ) {}

  async list(): Promise<Author[]> {
    const [rows, counts] = await Promise.all([
      this.db.select().from(authorProfiles).orderBy(asc(authorProfiles.name)),
      this.stats.publishedArticlesByAuthor(),
    ]);
    return rows.map((r) => toAuthor(r, counts.get(r.id) ?? 0));
  }

  async byIds(ids: string[], tx: DbOrTx = this.db): Promise<Map<string, Author>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await tx.select().from(authorProfiles).where(inArray(authorProfiles.id, unique));
    return new Map(rows.map((r) => [r.id, toAuthor(r, 0)]));
  }

  async bySlug(slug: string): Promise<Author | null> {
    const [row] = await this.db.select().from(authorProfiles).where(eq(authorProfiles.slug, slug));
    if (!row) return null;
    const counts = await this.stats.publishedArticlesByAuthor();
    return toAuthor(row, counts.get(row.id) ?? 0);
  }

  /** The author profile linked to a staff account (used as default author of new drafts). */
  async byUserId(userId: string, tx: DbOrTx = this.db): Promise<Author | null> {
    const [row] = await tx.select().from(authorProfiles).where(eq(authorProfiles.userId, userId));
    return row ? toAuthor(row, 0) : null;
  }

  async create(user: AuthUser, input: AuthorInput, ip: string | null): Promise<Author> {
    return this.db.transaction(async (tx) => {
      const row = await this.unique(() =>
        tx
          .insert(authorProfiles)
          .values(input)
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'author.create',
        entityType: 'author',
        entityId: row.id,
        diff: { name: row.name, slug: row.slug },
        ip,
      });
      return toAuthor(row, 0);
    });
  }

  async update(user: AuthUser, id: string, input: AuthorInput, ip: string | null): Promise<Author> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.id, id))
        .for('update');
      if (!before) throw notFound('Автор не найден');
      const row = await this.unique(() =>
        tx
          .update(authorProfiles)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(authorProfiles.id, id))
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'author.update',
        entityType: 'author',
        entityId: id,
        diff: changes(before, row, ['name', 'slug', 'jobTitle', 'bio', 'avatarMediaId', 'userId']),
        ip,
      });
      return toAuthor(row, 0);
    });
  }

  async delete(user: AuthUser, id: string, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.id, id))
        .for('update');
      if (!row) throw notFound('Автор не найден');
      if (await this.stats.isAuthorInUse(id)) throw conflict('Автор указан в материалах');
      await tx.delete(authorProfiles).where(eq(authorProfiles.id, id));
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'author.delete',
        entityType: 'author',
        entityId: id,
        diff: { name: row.name, slug: row.slug },
        ip,
      });
    });
  }

  private async unique(op: () => Promise<AuthorRow | undefined>): Promise<AuthorRow> {
    try {
      const row = await op();
      if (!row) throw notFound('Автор не найден');
      return row;
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw conflict('Slug или учётная запись уже привязаны к другому автору', [
          { path: 'slug', message: 'Уже занят' },
        ]);
      }
      throw error;
    }
  }
}

function toAuthor(r: AuthorRow, articleCount: number): Author {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    jobTitle: r.jobTitle,
    bio: r.bio,
    avatarMediaId: r.avatarMediaId,
    userId: r.userId,
    articleCount,
  };
}
