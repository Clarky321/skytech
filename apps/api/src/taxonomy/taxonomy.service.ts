import { Inject, Injectable } from '@nestjs/common';
import {
  type Category,
  type CategoryInput,
  type CategoryTreeNode,
  type Tag,
  type TagInput,
  urls,
} from '@skytech/contracts';
import { asc, eq, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { ContentStatsService } from '../content/content-stats.service.js';
import { categories, tags } from '../db/schema/index.js';
import { DB, type Db, type DbOrTx, PG_UNIQUE_VIOLATION, pgErrorCode } from '../platform/db.js';
import { conflict, notFound, unprocessable } from '../platform/problem.js';

type CategoryRow = typeof categories.$inferSelect;
type TagRow = typeof tags.$inferSelect;

export interface CategoryWithPath extends Category {
  path: string;
  parent: CategoryRow | null;
}

@Injectable()
export class TaxonomyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly stats: ContentStatsService,
  ) {}

  // ---------- categories ----------

  async categoryTree(): Promise<CategoryTreeNode[]> {
    const [rows, counts] = await Promise.all([
      this.db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      this.stats.publishedArticlesByCategory(),
    ]);
    const toCategory = (r: CategoryRow): Category => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parentId: r.parentId,
      description: r.description,
      sortOrder: r.sortOrder,
      articleCount: counts.get(r.id) ?? 0,
    });
    return rows
      .filter((r) => r.parentId === null)
      .map((root) => ({
        ...toCategory(root),
        path: urls.category([root.slug]),
        children: rows.filter((c) => c.parentId === root.id).map(toCategory),
      }));
  }

  async categoriesByIds(
    ids: string[],
    tx: DbOrTx = this.db,
  ): Promise<Map<string, CategoryWithPath>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await tx.select().from(categories).where(inArray(categories.id, unique));
    const parentIds = rows.map((r) => r.parentId).filter((id): id is string => id !== null);
    const parents = parentIds.length
      ? await tx.select().from(categories).where(inArray(categories.id, parentIds))
      : [];
    const parentById = new Map(parents.map((p) => [p.id, p]));
    return new Map(
      rows.map((r) => {
        const parent = r.parentId ? (parentById.get(r.parentId) ?? null) : null;
        return [
          r.id,
          {
            id: r.id,
            name: r.name,
            slug: r.slug,
            parentId: r.parentId,
            description: r.description,
            sortOrder: r.sortOrder,
            articleCount: 0,
            parent,
            path: urls.category(parent ? [parent.slug, r.slug] : [r.slug]),
          },
        ];
      }),
    );
  }

  /** Category by its own slug, with children ids (a parent page lists its children too). */
  async categoryBySlug(slug: string): Promise<(CategoryWithPath & { childIds: string[] }) | null> {
    const [row] = await this.db.select().from(categories).where(eq(categories.slug, slug));
    if (!row) return null;
    const full = (await this.categoriesByIds([row.id])).get(row.id);
    if (!full) return null;
    const children = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, row.id));
    return { ...full, childIds: children.map((c) => c.id) };
  }

  async createCategory(
    user: AuthUser,
    input: CategoryInput,
    ip: string | null,
  ): Promise<CategoryRow> {
    return this.db.transaction(async (tx) => {
      await this.assertValidParent(tx, input.parentId, null);
      const row = await this.uniqueSlug(() =>
        tx
          .insert(categories)
          .values(input)
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'category.create',
        entityType: 'category',
        entityId: row.id,
        diff: { name: row.name, slug: row.slug, parentId: row.parentId },
        ip,
      });
      return row;
    });
  }

  async updateCategory(
    user: AuthUser,
    id: string,
    input: CategoryInput,
    ip: string | null,
  ): Promise<CategoryRow> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .for('update');
      if (!before) throw notFound('Категория не найдена');
      await this.assertValidParent(tx, input.parentId, id);
      const row = await this.uniqueSlug(() =>
        tx
          .update(categories)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'category.update',
        entityType: 'category',
        entityId: id,
        diff: changes(before, row, ['name', 'slug', 'parentId', 'description', 'sortOrder']),
        ip,
      });
      return row;
    });
  }

  async deleteCategory(user: AuthUser, id: string, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(categories).where(eq(categories.id, id)).for('update');
      if (!row) throw notFound('Категория не найдена');
      const [child] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, id))
        .limit(1);
      if (child) throw conflict('Сначала удалите или перенесите подкатегории');
      if (await this.stats.isCategoryInUse(id)) {
        throw conflict('Категория используется в материалах');
      }
      await tx.delete(categories).where(eq(categories.id, id));
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'category.delete',
        entityType: 'category',
        entityId: id,
        diff: { name: row.name, slug: row.slug },
        ip,
      });
    });
  }

  /** Depth ≤ 2: a parent must itself be a root, and a category with children cannot get a parent. */
  private async assertValidParent(tx: DbOrTx, parentId: string | null, selfId: string | null) {
    if (!parentId) return;
    if (parentId === selfId) throw unprocessable('Категория не может быть родителем самой себя');
    const [parent] = await tx.select().from(categories).where(eq(categories.id, parentId));
    if (!parent)
      throw unprocessable('Родительская категория не найдена', [
        { path: 'parentId', message: 'Не найдена' },
      ]);
    if (parent.parentId) {
      throw unprocessable('Допустимо только два уровня категорий', [
        { path: 'parentId', message: 'Выберите категорию верхнего уровня' },
      ]);
    }
    if (selfId) {
      const [child] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, selfId))
        .limit(1);
      if (child)
        throw unprocessable('У категории есть подкатегории — она должна остаться верхнего уровня');
    }
  }

  // ---------- tags ----------

  async listTags(): Promise<Tag[]> {
    const [rows, counts] = await Promise.all([
      this.db.select().from(tags).orderBy(asc(tags.name)),
      this.stats.publishedArticlesByTag(),
    ]);
    return rows.map((r) => toTag(r, counts.get(r.id) ?? 0));
  }

  async tagsByIds(ids: string[], tx: DbOrTx = this.db): Promise<Map<string, Tag>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await tx.select().from(tags).where(inArray(tags.id, unique));
    return new Map(rows.map((r) => [r.id, toTag(r, 0)]));
  }

  async tagBySlug(slug: string): Promise<Tag | null> {
    const [row] = await this.db.select().from(tags).where(eq(tags.slug, slug));
    if (!row) return null;
    const counts = await this.stats.publishedArticlesByTag();
    return toTag(row, counts.get(row.id) ?? 0);
  }

  async createTag(user: AuthUser, input: TagInput, ip: string | null): Promise<Tag> {
    return this.db.transaction(async (tx) => {
      const row = await this.uniqueSlug(() =>
        tx
          .insert(tags)
          .values(input)
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'tag.create',
        entityType: 'tag',
        entityId: row.id,
        diff: { name: row.name, slug: row.slug },
        ip,
      });
      return toTag(row, 0);
    });
  }

  async updateTag(user: AuthUser, id: string, input: TagInput, ip: string | null): Promise<Tag> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(tags).where(eq(tags.id, id)).for('update');
      if (!before) throw notFound('Тег не найден');
      const row = await this.uniqueSlug(() =>
        tx
          .update(tags)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(tags.id, id))
          .returning()
          .then((r) => r[0]),
      );
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'tag.update',
        entityType: 'tag',
        entityId: id,
        diff: changes(before, row, ['name', 'slug', 'description']),
        ip,
      });
      return toTag(row, 0);
    });
  }

  async deleteTag(user: AuthUser, id: string, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(tags).where(eq(tags.id, id)).for('update');
      if (!row) throw notFound('Тег не найден');
      if (await this.stats.isTagInUse(id)) throw conflict('Тег используется в материалах');
      await tx.delete(tags).where(eq(tags.id, id));
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'tag.delete',
        entityType: 'tag',
        entityId: id,
        diff: { name: row.name, slug: row.slug },
        ip,
      });
    });
  }

  private async uniqueSlug<T>(op: () => Promise<T | undefined>): Promise<T> {
    try {
      const row = await op();
      if (!row) throw notFound();
      return row;
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw conflict('Такой slug уже используется', [{ path: 'slug', message: 'Уже занят' }]);
      }
      throw error;
    }
  }
}

function toTag(r: TagRow, articleCount: number): Tag {
  return { id: r.id, name: r.name, slug: r.slug, description: r.description, articleCount };
}

export function changes<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: (keyof T & string)[],
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      out[key] = { from: before[key], to: after[key] };
    }
  }
  return out;
}
