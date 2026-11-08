import { Inject, Injectable, Logger } from '@nestjs/common';
import { renderDocument } from '@skytech/content-render';
import {
  type AdminContentDetail,
  type AdminContentListItem,
  type ArticleFull,
  collectMediaIds,
  type ContentAction,
  type ContentDraft,
  type ContentListQuery,
  type ContentType,
  type CreateContentInput,
  DOCUMENT_SCHEMA_VERSION,
  EMPTY_DOCUMENT,
  hasPermission,
  type Paginated,
  RESERVED_PAGE_SLUGS,
  type RevisionSummary,
  slugify,
} from '@skytech/contracts';
import { and, count, desc, eq, ilike, inArray, lte, ne, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { OutboxService } from '../audit/outbox.service.js';
import { AuthorsService } from '../authors/authors.service.js';
import type { AuthUser } from '../auth/decorators.js';
import {
  content,
  contentRevisions,
  contentTags,
  redirects,
  revisionMedia,
} from '../db/schema/index.js';
import { escapeLike, MediaService } from '../media/media.service.js';
import { DB, type Db, type Tx, PG_UNIQUE_VIOLATION, pgErrorCode } from '../platform/db.js';
import { conflict, forbidden, notFound, unprocessable } from '../platform/problem.js';
import { TaxonomyService } from '../taxonomy/taxonomy.service.js';
import { UsersService } from '../users/users.service.js';
import { contentPath, ContentQueryService } from './content-query.service.js';
import {
  allowedActions,
  canEdit,
  hasUnpublishedChanges,
  publishIssues,
  type WorkflowActor,
} from './content-workflow.js';

type ContentRow = typeof content.$inferSelect;
type RevisionRow = typeof contentRevisions.$inferSelect;

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly taxonomy: TaxonomyService,
    private readonly authors: AuthorsService,
    private readonly media: MediaService,
    private readonly users: UsersService,
    private readonly query: ContentQueryService,
  ) {}

  // ------------------------------------------------------------------ reads

  async list(user: AuthUser, q: ContentListQuery): Promise<Paginated<AdminContentListItem>> {
    const conditions: SQL[] = [eq(content.type, q.type)];
    if (q.status) conditions.push(eq(content.status, q.status));
    if (q.q) conditions.push(ilike(contentRevisions.title, `%${escapeLike(q.q)}%`));
    // Authors only see their own materials.
    if (!hasPermission(user.role, 'content.edit_any'))
      conditions.push(eq(content.createdBy, user.id));
    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({ content, revision: contentRevisions })
        .from(content)
        .innerJoin(contentRevisions, eq(contentRevisions.id, content.draftRevisionId))
        .where(where)
        .orderBy(desc(content.updatedAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db
        .select({ value: count() })
        .from(content)
        .innerJoin(contentRevisions, eq(contentRevisions.id, content.draftRevisionId))
        .where(where),
    ]);

    const [authors, categories, users] = await Promise.all([
      this.authors.byIds(rows.map((r) => r.revision.authorId).filter(isString)),
      this.taxonomy.categoriesByIds(rows.map((r) => r.revision.categoryId).filter(isString)),
      this.users.findNames(rows.map((r) => r.content.createdBy).filter(isString)),
    ]);

    return {
      items: rows.map(({ content: c, revision: r }) => {
        const author = r.authorId ? authors.get(r.authorId) : undefined;
        const category = r.categoryId ? categories.get(r.categoryId) : undefined;
        const creator = c.createdBy ? users.get(c.createdBy) : undefined;
        return {
          id: c.id,
          type: c.type,
          status: c.status,
          title: r.title,
          slug: r.slug,
          author: author ? { id: author.id, name: author.name } : null,
          category: category ? { id: category.id, name: category.name } : null,
          hasUnpublishedChanges: c.status === 'published' && hasUnpublishedChanges(c),
          createdBy: c.createdBy && creator ? { id: c.createdBy, name: creator } : null,
          updatedAt: c.updatedAt.toISOString(),
          publishedAt: c.publishedAt?.toISOString() ?? null,
          scheduledAt: c.scheduledAt?.toISOString() ?? null,
        };
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: total?.value ?? 0,
    };
  }

  async get(user: AuthUser, id: string): Promise<AdminContentDetail> {
    const row = await this.findVisible(user, id);
    return this.toDetail(user, row);
  }

  async revisions(user: AuthUser, id: string): Promise<RevisionSummary[]> {
    const row = await this.findVisible(user, id);
    const revs = await this.db
      .select({
        id: contentRevisions.id,
        createdAt: contentRevisions.createdAt,
        createdBy: contentRevisions.createdBy,
        title: contentRevisions.title,
        note: contentRevisions.note,
      })
      .from(contentRevisions)
      .where(eq(contentRevisions.contentId, id))
      .orderBy(desc(contentRevisions.createdAt))
      .limit(200);
    const names = await this.users.findNames(revs.map((r) => r.createdBy).filter(isString));
    return revs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy ? { id: r.createdBy, name: names.get(r.createdBy) ?? '—' } : null,
      title: r.title,
      note: r.note,
      isDraft: r.id === row.draftRevisionId,
      isPublished: r.id === row.publishedRevisionId,
    }));
  }

  /** The saved draft rendered exactly like the public page. */
  async preview(user: AuthUser, id: string): Promise<ArticleFull> {
    const row = await this.findVisible(user, id);
    const revision = await this.revision(this.db, row.draftRevisionId);
    return this.query.preview({ content: row, revision });
  }

  // ----------------------------------------------------------------- writes

  async create(
    user: AuthUser,
    input: CreateContentInput,
    ip: string | null,
  ): Promise<AdminContentDetail> {
    if (!hasPermission(user.role, 'content.create')) throw forbidden();
    const row = await this.db.transaction(async (tx) => {
      const ownAuthor = await this.authors.byUserId(user.id, tx);
      const slug = await this.freeSlug(tx, input.type, slugify(input.title) || 'novyy-material');
      const [created] = await tx
        .insert(content)
        .values({ type: input.type, slug, createdBy: user.id })
        .returning();
      if (!created) throw new Error('content insert returned no row');
      const draft: ContentDraft = {
        title: input.title,
        slug,
        excerpt: '',
        body: EMPTY_DOCUMENT,
        categoryId: null,
        tagIds: [],
        authorId: input.type === 'article' ? (ownAuthor?.id ?? null) : null,
        coverMediaId: null,
        seoTitle: '',
        seoDescription: '',
      };
      const revision = await this.insertRevision(tx, created, draft, user, 'Создание');
      const [updated] = await tx
        .update(content)
        .set({ draftRevisionId: revision.id })
        .where(eq(content.id, created.id))
        .returning();
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'content.create',
        entityType: 'content',
        entityId: created.id,
        diff: { type: input.type, title: input.title, slug },
        ip,
      });
      return updated ?? created;
    });
    return this.toDetail(user, row);
  }

  /** Saves the editor state as a new immutable revision (optimistic lock on `version`). */
  async saveDraft(
    user: AuthUser,
    id: string,
    input: ContentDraft & { version: number; note: string },
    ip: string | null,
  ): Promise<AdminContentDetail> {
    const row = await this.mutate(user, id, input.version, 'edit', async (tx, current) => {
      const previous = await this.revision(tx, current.draftRevisionId);
      await this.assertSlugAvailable(tx, current, input.slug);
      const { version: _v, note, ...draft } = input;
      const revision = await this.insertRevision(tx, current, draft, user, note);
      const [updated] = await tx
        .update(content)
        .set({
          slug: draft.slug,
          draftRevisionId: revision.id,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(content.id, id))
        .returning();
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'content.save_draft',
        entityType: 'content',
        entityId: id,
        diff: {
          revisionId: revision.id,
          ...draftChanges(previous, revision),
        },
        ip,
      });
      return updated;
    });
    return this.toDetail(user, row);
  }

  async submit(user: AuthUser, id: string, version: number, ip: string | null) {
    const row = await this.mutate(user, id, version, 'submit', (tx, current) =>
      this.setStatus(tx, user, current, { status: 'review' }, 'content.submit', ip),
    );
    return this.toDetail(user, row);
  }

  async publish(user: AuthUser, id: string, version: number, ip: string | null) {
    const row = await this.mutate(user, id, version, 'publish', (tx, current) =>
      this.publishInTx(tx, user.id, current, ip),
    );
    return this.toDetail(user, row);
  }

  async schedule(user: AuthUser, id: string, version: number, at: Date, ip: string | null) {
    if (at.getTime() <= Date.now() + 30_000) {
      throw unprocessable('Время публикации должно быть в будущем', [
        { path: 'scheduledAt', message: 'Укажите время позже текущего' },
      ]);
    }
    const row = await this.mutate(user, id, version, 'schedule', async (tx, current) => {
      const revision = await this.revision(tx, current.draftRevisionId);
      this.assertPublishable(current.type, revision);
      await this.assertPublishedSlugFree(tx, current, revision.slug);
      return this.setStatus(
        tx,
        user,
        current,
        { status: 'scheduled', scheduledAt: at },
        'content.schedule',
        ip,
        { scheduledAt: at.toISOString() },
      );
    });
    return this.toDetail(user, row);
  }

  async unpublish(user: AuthUser, id: string, version: number, ip: string | null) {
    const row = await this.mutate(user, id, version, 'unpublish', (tx, current) =>
      this.takeOffline(tx, user, current, 'draft', 'content.unpublish', ip),
    );
    return this.toDetail(user, row);
  }

  async archive(user: AuthUser, id: string, version: number, ip: string | null) {
    const row = await this.mutate(user, id, version, 'archive', (tx, current) =>
      this.takeOffline(tx, user, current, 'archived', 'content.archive', ip),
    );
    return this.toDetail(user, row);
  }

  async restore(user: AuthUser, id: string, version: number, ip: string | null) {
    const row = await this.mutate(user, id, version, 'restore', (tx, current) =>
      this.setStatus(tx, user, current, { status: 'draft' }, 'content.restore', ip),
    );
    return this.toDetail(user, row);
  }

  /** Makes an old revision the current draft (as a new revision; history stays intact). */
  async restoreRevision(
    user: AuthUser,
    id: string,
    revisionId: string,
    version: number,
    ip: string | null,
  ): Promise<AdminContentDetail> {
    const row = await this.mutate(user, id, version, 'edit', async (tx, current) => {
      const source = await this.revision(tx, revisionId);
      if (source.contentId !== id) throw notFound('Версия не найдена');
      await this.assertSlugAvailable(tx, current, source.slug);
      const draft: ContentDraft = {
        title: source.title,
        slug: source.slug,
        excerpt: source.excerpt,
        body: source.body,
        categoryId: source.categoryId,
        tagIds: source.tagIds,
        authorId: source.authorId,
        coverMediaId: source.coverMediaId,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
      };
      const when = source.createdAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
      const revision = await this.insertRevision(
        tx,
        current,
        draft,
        user,
        `Восстановлено из версии от ${when}`,
        {
          lenientReferences: true,
        },
      );
      const [updated] = await tx
        .update(content)
        .set({
          slug: draft.slug,
          draftRevisionId: revision.id,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(content.id, id))
        .returning();
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'content.restore_revision',
        entityType: 'content',
        entityId: id,
        diff: { fromRevisionId: revisionId, revisionId: revision.id },
        ip,
      });
      return updated;
    });
    return this.toDetail(user, row);
  }

  /** Worker: publishes scheduled materials whose time has come. Returns how many. */
  async publishDueScheduled(now = new Date()): Promise<number> {
    let published = 0;
    // One row per transaction; SKIP LOCKED lets several workers run safely.
    for (;;) {
      const done = await this.db.transaction(async (tx) => {
        const [due] = await tx
          .select()
          .from(content)
          .where(and(eq(content.status, 'scheduled'), lte(content.scheduledAt, now)))
          .orderBy(content.scheduledAt)
          .limit(1)
          .for('update', { skipLocked: true });
        if (!due) return false;
        try {
          // Savepoint: a failed publish (even a SQL error) leaves the outer transaction usable.
          await tx.transaction((sp) => this.publishInTx(sp, null, due, null));
          published++;
        } catch (error) {
          // Not publishable anymore (e.g. slug taken): return to draft instead of retrying forever.
          this.logger.warn(`Scheduled publish of ${due.id} failed: ${String(error)}`);
          await tx
            .update(content)
            .set({
              status: 'draft',
              scheduledAt: null,
              version: due.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(content.id, due.id));
          await this.audit.record(tx, {
            actorUserId: null,
            action: 'content.schedule_failed',
            entityType: 'content',
            entityId: due.id,
            diff: { reason: error instanceof Error ? error.message : String(error) },
          });
        }
        return true;
      });
      if (!done) return published;
    }
  }

  // --------------------------------------------------------------- internals

  /**
   * Loads the row FOR UPDATE, checks visibility, the optimistic lock and that `action`
   * is allowed for this user in the current state, then runs `fn` in the same transaction.
   */
  private async mutate(
    user: AuthUser,
    id: string,
    version: number,
    action: ContentAction,
    fn: (tx: Tx, current: ContentRow) => Promise<ContentRow | undefined>,
  ): Promise<ContentRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx.select().from(content).where(eq(content.id, id)).for('update');
        if (!current || !this.isVisible(user, current)) throw notFound('Материал не найден');
        if (current.version !== version) {
          throw conflict(
            'Материал был изменён в другом окне или другим пользователем. Обновите страницу, чтобы не потерять чужие правки.',
            undefined,
            'version_conflict',
          );
        }
        if (!allowedActions(actor(user), current).includes(action)) {
          throw forbidden(
            action === 'edit'
              ? 'Нет прав на изменение этого материала'
              : 'Это действие недоступно для текущего статуса или вашей роли',
          );
        }
        const result = await fn(tx, current);
        if (!result) throw new Error('mutation returned no row');
        return result;
      });
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw conflict('Такой slug уже используется', [{ path: 'slug', message: 'Уже занят' }]);
      }
      throw error;
    }
  }

  private async publishInTx(
    tx: Tx,
    actorId: string | null,
    current: ContentRow,
    ip: string | null,
  ) {
    const revision = await this.revision(tx, current.draftRevisionId);
    this.assertPublishable(current.type, revision);
    await this.assertPublishedSlugFree(tx, current, revision.slug);

    const newPath = contentPath(current.type, revision.slug);
    const oldSlug = current.publishedSlug;
    if (oldSlug && oldSlug !== revision.slug) {
      const oldPath = contentPath(current.type, oldSlug);
      // Keep old links working and avoid redirect chains.
      await tx.update(redirects).set({ toPath: newPath }).where(eq(redirects.toPath, oldPath));
      await tx
        .insert(redirects)
        .values({ fromPath: oldPath, toPath: newPath })
        .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: newPath } });
    }
    // A live material always wins over a redirect at the same address.
    await tx.delete(redirects).where(eq(redirects.fromPath, newPath));

    const now = new Date();
    const [updated] = await tx
      .update(content)
      .set({
        status: 'published',
        publishedRevisionId: revision.id,
        publishedSlug: revision.slug,
        publishedAt: current.publishedAt ?? now,
        updatedContentAt: now,
        scheduledAt: null,
        version: current.version + 1,
        updatedAt: now,
      })
      .where(eq(content.id, current.id))
      .returning();

    await tx.delete(contentTags).where(eq(contentTags.contentId, current.id));
    const existingTags = await this.taxonomy.tagsByIds(revision.tagIds, tx);
    if (existingTags.size > 0) {
      await tx
        .insert(contentTags)
        .values([...existingTags.keys()].map((tagId) => ({ contentId: current.id, tagId })));
    }

    await this.outbox.add(tx, 'content.published', {
      contentId: current.id,
      type: current.type,
      path: newPath,
      previousPath:
        oldSlug && oldSlug !== revision.slug ? contentPath(current.type, oldSlug) : null,
    });
    await this.audit.record(tx, {
      actorUserId: actorId,
      action: 'content.publish',
      entityType: 'content',
      entityId: current.id,
      diff: {
        revisionId: revision.id,
        status: { from: current.status, to: 'published' },
        ...(oldSlug !== revision.slug
          ? { publishedSlug: { from: oldSlug, to: revision.slug } }
          : {}),
      },
      ip,
    });
    return updated;
  }

  private async takeOffline(
    tx: Tx,
    user: AuthUser,
    current: ContentRow,
    status: 'draft' | 'archived',
    action: string,
    ip: string | null,
  ) {
    const wasLive = current.status === 'published';
    const [updated] = await tx
      .update(content)
      .set({
        status,
        publishedRevisionId: null,
        publishedSlug: null,
        scheduledAt: null,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(content.id, current.id))
      .returning();
    if (wasLive) {
      await tx.delete(contentTags).where(eq(contentTags.contentId, current.id));
      await this.outbox.add(tx, 'content.unpublished', {
        contentId: current.id,
        type: current.type,
        path: current.publishedSlug ? contentPath(current.type, current.publishedSlug) : null,
      });
    }
    await this.audit.record(tx, {
      actorUserId: user.id,
      action,
      entityType: 'content',
      entityId: current.id,
      diff: { status: { from: current.status, to: status } },
      ip,
    });
    return updated;
  }

  private async setStatus(
    tx: Tx,
    user: AuthUser,
    current: ContentRow,
    patch: { status: ContentRow['status']; scheduledAt?: Date | null },
    action: string,
    ip: string | null,
    extraDiff: Record<string, unknown> = {},
  ) {
    const [updated] = await tx
      .update(content)
      .set({ scheduledAt: null, ...patch, version: current.version + 1, updatedAt: new Date() })
      .where(eq(content.id, current.id))
      .returning();
    await this.audit.record(tx, {
      actorUserId: user.id,
      action,
      entityType: 'content',
      entityId: current.id,
      diff: { status: { from: current.status, to: patch.status }, ...extraDiff },
      ip,
    });
    return updated;
  }

  /**
   * Validates references, renders the body and stores an immutable revision together with
   * its media usage rows (which protect referenced media from deletion).
   */
  private async insertRevision(
    tx: Tx,
    row: ContentRow,
    draft: ContentDraft,
    user: AuthUser,
    note: string,
    options: { lenientReferences?: boolean } = {},
  ): Promise<RevisionRow> {
    const bodyMediaIds = collectMediaIds(draft.body);
    const mediaIds = [
      ...new Set([...bodyMediaIds, ...(draft.coverMediaId ? [draft.coverMediaId] : [])]),
    ];
    // Sequential on purpose: a transaction has one connection, parallel queries would queue.
    const missingMedia = await this.media.findMissing(mediaIds, tx);
    const categories = await this.taxonomy.categoriesByIds(
      draft.categoryId ? [draft.categoryId] : [],
      tx,
    );
    const tags = await this.taxonomy.tagsByIds(draft.tagIds, tx);
    const authors = await this.authors.byIds(draft.authorId ? [draft.authorId] : [], tx);

    const errors: { path: string; message: string }[] = [];
    if (draft.categoryId && !categories.has(draft.categoryId)) {
      errors.push({ path: 'categoryId', message: 'Категория не найдена' });
    }
    if (draft.tagIds.some((t) => !tags.has(t)))
      errors.push({ path: 'tagIds', message: 'Тег не найден' });
    if (draft.authorId && !authors.has(draft.authorId)) {
      errors.push({ path: 'authorId', message: 'Автор не найден' });
    }
    if (draft.coverMediaId && missingMedia.includes(draft.coverMediaId)) {
      errors.push({ path: 'coverMediaId', message: 'Обложка не найдена' });
    }
    if (bodyMediaIds.some((m) => missingMedia.includes(m))) {
      errors.push({ path: 'body', message: 'В тексте есть изображение, которого нет в медиатеке' });
    }
    if (row.type === 'page' && (RESERVED_PAGE_SLUGS as readonly string[]).includes(draft.slug)) {
      errors.push({ path: 'slug', message: 'Этот адрес зарезервирован сайтом' });
    }
    if (errors.length > 0 && !options.lenientReferences) {
      throw unprocessable('Проверьте поля материала', errors);
    }

    // When restoring old revisions, references that no longer exist are dropped, not fatal.
    const safeDraft: ContentDraft = options.lenientReferences
      ? {
          ...draft,
          categoryId:
            draft.categoryId && categories.has(draft.categoryId) ? draft.categoryId : null,
          tagIds: draft.tagIds.filter((t) => tags.has(t)),
          authorId: draft.authorId && authors.has(draft.authorId) ? draft.authorId : null,
          coverMediaId:
            draft.coverMediaId && !missingMedia.includes(draft.coverMediaId)
              ? draft.coverMediaId
              : null,
        }
      : draft;

    const refs = await this.media.getRefs(bodyMediaIds, tx);
    const rendered = renderDocument(safeDraft.body, {
      resolveMedia: (mediaId) => refs.get(mediaId),
    });

    const [revision] = await tx
      .insert(contentRevisions)
      .values({
        contentId: row.id,
        title: safeDraft.title,
        slug: safeDraft.slug,
        excerpt: safeDraft.excerpt,
        body: safeDraft.body,
        bodySchemaVersion: DOCUMENT_SCHEMA_VERSION,
        categoryId: safeDraft.categoryId,
        tagIds: safeDraft.tagIds,
        authorId: safeDraft.authorId,
        coverMediaId: safeDraft.coverMediaId,
        seoTitle: safeDraft.seoTitle,
        seoDescription: safeDraft.seoDescription,
        html: rendered.html,
        toc: rendered.toc,
        plainText: rendered.plainText,
        wordCount: rendered.wordCount,
        readingTimeMinutes: rendered.readingTimeMinutes,
        note,
        createdBy: user.id,
      })
      .returning();
    if (!revision) throw new Error('revision insert returned no row');

    const usedMedia = mediaIds.filter((m) => !missingMedia.includes(m));
    if (usedMedia.length > 0) {
      await tx
        .insert(revisionMedia)
        .values(usedMedia.map((mediaId) => ({ revisionId: revision.id, mediaId })));
    }
    return revision;
  }

  private assertPublishable(type: ContentType, revision: RevisionRow): void {
    const issues = publishIssues(type, {
      ...revision,
      hasImages: collectMediaIds(revision.body).length > 0,
    });
    if (issues.length > 0) {
      throw unprocessable(
        'Материал нельзя опубликовать',
        issues.map((message) => ({ path: 'publish', message })),
      );
    }
  }

  private async assertSlugAvailable(tx: Tx, current: ContentRow, slug: string): Promise<void> {
    const [taken] = await tx
      .select({ id: content.id })
      .from(content)
      .where(
        and(eq(content.type, current.type), eq(content.slug, slug), ne(content.id, current.id)),
      )
      .limit(1);
    if (taken)
      throw conflict('Такой slug уже используется другим материалом', [
        { path: 'slug', message: 'Уже занят' },
      ]);
  }

  private async assertPublishedSlugFree(tx: Tx, current: ContentRow, slug: string): Promise<void> {
    const [taken] = await tx
      .select({ id: content.id })
      .from(content)
      .where(
        and(
          eq(content.type, current.type),
          eq(content.publishedSlug, slug),
          ne(content.id, current.id),
        ),
      )
      .limit(1);
    if (taken)
      throw conflict('По этому адресу уже опубликован другой материал', [
        { path: 'slug', message: 'Уже занят' },
      ]);
  }

  private async freeSlug(tx: Tx, type: ContentType, base: string): Promise<string> {
    const candidates = [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${String(i + 2)}`)];
    const taken = await tx
      .select({ slug: content.slug })
      .from(content)
      .where(and(eq(content.type, type), inArray(content.slug, candidates)));
    const used = new Set(taken.map((t) => t.slug));
    return candidates.find((c) => !used.has(c)) ?? `${base}-${Date.now().toString(36)}`;
  }

  private isVisible(user: AuthUser, row: ContentRow): boolean {
    return canEdit(actor(user), row) || hasPermission(user.role, 'content.edit_any');
  }

  private async findVisible(user: AuthUser, id: string): Promise<ContentRow> {
    const [row] = await this.db.select().from(content).where(eq(content.id, id));
    // 404 (not 403) so authors cannot probe for other people's drafts.
    if (!row || !this.isVisible(user, row)) throw notFound('Материал не найден');
    return row;
  }

  private async revision(tx: Db | Tx, id: string | null): Promise<RevisionRow> {
    if (!id) throw new Error('content has no draft revision');
    const [row] = await tx.select().from(contentRevisions).where(eq(contentRevisions.id, id));
    if (!row) throw notFound('Версия не найдена');
    return row;
  }

  private async toDetail(user: AuthUser, row: ContentRow): Promise<AdminContentDetail> {
    const revision = await this.revision(this.db, row.draftRevisionId);
    const creator = row.createdBy
      ? (await this.users.findNames([row.createdBy])).get(row.createdBy)
      : undefined;
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      version: row.version,
      draft: {
        title: revision.title,
        slug: revision.slug,
        excerpt: revision.excerpt,
        body: revision.body,
        categoryId: revision.categoryId,
        tagIds: revision.tagIds,
        authorId: revision.authorId,
        coverMediaId: revision.coverMediaId,
        seoTitle: revision.seoTitle,
        seoDescription: revision.seoDescription,
      },
      draftRevisionId: revision.id,
      publishedRevisionId: row.publishedRevisionId,
      publishedSlug: row.publishedSlug,
      hasUnpublishedChanges: row.status === 'published' && hasUnpublishedChanges(row),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy && creator ? { id: row.createdBy, name: creator } : null,
      allowedActions: allowedActions(actor(user), row),
      publishIssues: publishIssues(row.type, {
        ...revision,
        hasImages: collectMediaIds(revision.body).length > 0,
      }),
    };
  }
}

function actor(user: AuthUser): WorkflowActor {
  return { id: user.id, role: user.role };
}

function isString(value: string | null): value is string {
  return value !== null;
}

/** Small, meaningful audit diff of draft metadata (the body itself is in the revision). */
function draftChanges(before: RevisionRow, after: RevisionRow): Record<string, unknown> {
  const keys = [
    'title',
    'slug',
    'excerpt',
    'categoryId',
    'authorId',
    'coverMediaId',
    'seoTitle',
    'seoDescription',
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (before[key] !== after[key]) out[key] = { from: before[key], to: after[key] };
  }
  if (before.tagIds.join() !== after.tagIds.join())
    out.tagIds = { from: before.tagIds, to: after.tagIds };
  if (JSON.stringify(before.body) !== JSON.stringify(after.body)) out.body = 'changed';
  return out;
}
