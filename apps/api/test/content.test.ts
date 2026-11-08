import type { AdminContentDetail, SkyDocument } from '@skytech/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContentService } from '../src/content/content.service.js';
import { auditLog, content, outboxEvents } from '../src/db/schema/index.js';
import { createTestApp, resetState, type Session, signedIn, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

const body = (...paragraphs: string[]): SkyDocument => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Подготовка' }] },
    ...paragraphs.map((text) => ({
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text }],
    })),
    {
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Сохраните настройки IP и DNS' }] },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'powershell' },
      content: [{ type: 'text', text: 'Get-NetIPConfiguration' }],
    },
  ],
});

let editor: Session;
let categoryId: string;
let tagId: string;
let authorId: string;

beforeEach(async () => {
  await resetState(ctx);
  editor = await signedIn(ctx, 'editor');
  categoryId = (
    await editor.post('/api/admin/categories', { name: 'Сети', slug: 'networks' }).expect(201)
  ).body.id as string;
  tagId = (await editor.post('/api/admin/tags', { name: 'DNS', slug: 'dns' }).expect(201)).body
    .id as string;
  authorId = (
    await editor.post('/api/admin/authors', { name: 'Редакция', slug: 'redaktsiya' }).expect(201)
  ).body.id as string;
});

async function createArticle(
  session: Session,
  title = 'Настройка DNS',
): Promise<AdminContentDetail> {
  const res = await session.post('/api/admin/content', { type: 'article', title }).expect(201);
  return res.body as AdminContentDetail;
}

async function saveDraft(
  session: Session,
  detail: AdminContentDetail,
  patch: Record<string, unknown> = {},
): Promise<AdminContentDetail> {
  const res = await session
    .put(`/api/admin/content/${detail.id}/draft`, {
      ...detail.draft,
      categoryId,
      tagIds: [tagId],
      authorId,
      excerpt: 'Короткое описание',
      body: body('Откройте свойства адаптера.'),
      ...patch,
      version: detail.version,
    })
    .expect(200);
  return res.body as AdminContentDetail;
}

describe('authoring flow', () => {
  it('create → save → reopen → publish → visible on the public API', async () => {
    const created = await createArticle(editor, 'Диагностика DNS в Windows Server');
    expect(created.status).toBe('draft');
    expect(created.draft.slug).toBe('diagnostika-dns-v-windows-server');
    expect(created.allowedActions).toContain('publish');

    const saved = await saveDraft(editor, created);
    expect(saved.version).toBe(created.version + 1);

    // Reopen: the document comes back exactly as saved.
    const reopened = (await editor.get(`/api/admin/content/${created.id}`).expect(200))
      .body as AdminContentDetail;
    expect(reopened.draft.body).toEqual(body('Откройте свойства адаптера.'));
    expect(reopened.publishIssues).toEqual([]);

    // Draft is invisible to anonymous visitors.
    await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(404);
    expect((await ctx.http().get('/api/v1/articles').expect(200)).body.total).toBe(0);

    const published = (
      await editor
        .post(`/api/admin/content/${created.id}/publish`, { version: saved.version })
        .expect(200)
    ).body as AdminContentDetail;
    expect(published.status).toBe('published');
    expect(published.hasUnpublishedChanges).toBe(false);

    const pub = await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(200);
    expect(pub.body.kind).toBe('article');
    const article = pub.body.article;
    expect(article.title).toBe('Диагностика DNS в Windows Server');
    expect(article.html).toContain('<h3 id="podgotovka">');
    expect(article.html).toContain('callout--warning');
    expect(article.html).toContain('language-powershell');
    expect(article.toc).toEqual([{ id: 'podgotovka', text: 'Подготовка', level: 2 }]);
    expect(article.category).toMatchObject({ name: 'Сети', path: '/category/networks' });
    expect(article.tags).toEqual([{ id: tagId, name: 'DNS', slug: 'dns' }]);
    expect(article.author).toMatchObject({ name: 'Редакция' });

    const list = await ctx.http().get('/api/v1/articles?tag=dns').expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([created.id]);
    const byCategory = await ctx.http().get('/api/v1/articles?category=networks').expect(200);
    expect(byCategory.body.total).toBe(1);

    const events = await ctx.db.select().from(outboxEvents);
    expect(events.map((e) => e.type)).toEqual(['content.published']);
    const actions = (await ctx.db.select().from(auditLog)).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['content.create', 'content.save_draft', 'content.publish']),
    );
  });

  it('editing a published article does not change the site until it is published again', async () => {
    const created = await createArticle(editor);
    const saved = await saveDraft(editor, created);
    const published = (
      await editor
        .post(`/api/admin/content/${created.id}/publish`, { version: saved.version })
        .expect(200)
    ).body as AdminContentDetail;

    const edited = await saveDraft(editor, published, { title: 'Новый заголовок' });
    expect(edited.status).toBe('published');
    expect(edited.hasUnpublishedChanges).toBe(true);

    const live = await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(200);
    expect(live.body.article.title).toBe('Настройка DNS');

    await editor
      .post(`/api/admin/content/${created.id}/publish`, { version: edited.version })
      .expect(200);
    const updated = await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(200);
    expect(updated.body.article.title).toBe('Новый заголовок');
  });

  it('a slug change on republish keeps the old URL as a 301 redirect', async () => {
    const created = await createArticle(editor, 'Old title');
    const saved = await saveDraft(editor, created, { slug: 'old-slug' });
    const published = (
      await editor
        .post(`/api/admin/content/${created.id}/publish`, { version: saved.version })
        .expect(200)
    ).body as AdminContentDetail;
    const renamed = await saveDraft(editor, published, { slug: 'new-slug' });
    await editor
      .post(`/api/admin/content/${created.id}/publish`, { version: renamed.version })
      .expect(200);

    const old = await ctx.http().get('/api/v1/articles/old-slug').expect(200);
    expect(old.body).toEqual({ kind: 'redirect', location: '/articles/new-slug' });
    await ctx.http().get('/api/v1/articles/new-slug').expect(200);
  });

  it('a stale version is rejected with 409 and nothing is overwritten', async () => {
    const created = await createArticle(editor);
    await saveDraft(editor, created, { title: 'Первое окно' });
    const res = await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...created.draft,
        title: 'Второе окно',
        version: created.version,
      })
      .expect(409);
    expect(res.headers['x-problem-code']).toBe('version_conflict');
    const current = (await editor.get(`/api/admin/content/${created.id}`))
      .body as AdminContentDetail;
    expect(current.draft.title).toBe('Первое окно');
  });

  it('refuses to publish an incomplete article and explains why', async () => {
    const created = await createArticle(editor, '');
    const res = await editor
      .post(`/api/admin/content/${created.id}/publish`, { version: created.version })
      .expect(422);
    expect(res.body.errors.map((e: { message: string }) => e.message)).toEqual(
      expect.arrayContaining(['Укажите заголовок', 'Выберите категорию', 'Добавьте содержимое']),
    );
  });

  it('rejects unsafe documents (javascript: links, unknown nodes) with 422', async () => {
    const created = await createArticle(editor);
    const evil = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    };
    await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...created.draft,
        body: evil,
        version: created.version,
      })
      .expect(422);
    await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...created.draft,
        body: { type: 'doc', content: [{ type: 'iframe' }] },
        version: created.version,
      })
      .expect(422);
  });

  it('rejects references to missing categories or images', async () => {
    const created = await createArticle(editor);
    const res = await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...created.draft,
        categoryId: '00000000-0000-4000-8000-000000000000',
        body: {
          type: 'doc',
          content: [{ type: 'image', attrs: { mediaId: '00000000-0000-4000-8000-000000000001' } }],
        },
        version: created.version,
      })
      .expect(422);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(['categoryId', 'body']);
  });

  it('archive takes the article offline; restore brings it back as a draft', async () => {
    const created = await createArticle(editor);
    const saved = await saveDraft(editor, created);
    const pub = (
      await editor.post(`/api/admin/content/${created.id}/publish`, { version: saved.version })
    ).body as AdminContentDetail;
    const archived = (
      await editor
        .post(`/api/admin/content/${created.id}/archive`, { version: pub.version })
        .expect(200)
    ).body as AdminContentDetail;
    expect(archived.allowedActions).toEqual(['restore']);
    await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(404);
    // Archived material is read-only.
    await editor
      .put(`/api/admin/content/${created.id}/draft`, {
        ...archived.draft,
        version: archived.version,
      })
      .expect(403);
    const restored = (
      await editor
        .post(`/api/admin/content/${created.id}/restore`, { version: archived.version })
        .expect(200)
    ).body as AdminContentDetail;
    expect(restored.status).toBe('draft');
    expect((await ctx.db.select().from(outboxEvents)).map((e) => e.type)).toEqual([
      'content.published',
      'content.unpublished',
    ]);
  });

  it('keeps every save as a revision and can restore an old one', async () => {
    const created = await createArticle(editor);
    const v1 = await saveDraft(editor, created, { title: 'Версия 1' });
    const v2 = await saveDraft(editor, v1, { title: 'Версия 2' });
    const revisions = (await editor.get(`/api/admin/content/${created.id}/revisions`).expect(200))
      .body as {
      id: string;
      title: string;
      isDraft: boolean;
    }[];
    expect(revisions.map((r) => r.title)).toEqual(['Версия 2', 'Версия 1', 'Настройка DNS']);
    const first = revisions.find((r) => r.title === 'Версия 1');
    const restored = (
      await editor
        .post(`/api/admin/content/${created.id}/revisions/${first?.id ?? ''}/restore`, {
          version: v2.version,
        })
        .expect(200)
    ).body as AdminContentDetail;
    expect(restored.draft.title).toBe('Версия 1');
    expect((await editor.get(`/api/admin/content/${created.id}/revisions`)).body).toHaveLength(4);
  });

  it('preview renders the saved draft for staff only', async () => {
    const created = await createArticle(editor);
    await saveDraft(editor, created, { title: 'Черновик для предпросмотра' });
    const preview = await editor.get(`/api/admin/content/${created.id}/preview`).expect(200);
    expect(preview.body.title).toBe('Черновик для предпросмотра');
    expect(preview.body.html).toContain('callout--warning');
    await ctx.http().get(`/api/admin/content/${created.id}/preview`).expect(401);
  });
});

describe('roles', () => {
  it('an author can write and submit but never publish', async () => {
    const author = await signedIn(ctx, 'author');
    const created = await createArticle(author);
    expect(created.allowedActions).toEqual(['edit', 'submit']);
    const saved = await saveDraft(author, created);

    await author
      .post(`/api/admin/content/${created.id}/publish`, { version: saved.version })
      .expect(403);
    await author
      .post(`/api/admin/content/${created.id}/schedule`, {
        version: saved.version,
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      })
      .expect(403);

    const submitted = (
      await author
        .post(`/api/admin/content/${created.id}/submit`, { version: saved.version })
        .expect(200)
    ).body as AdminContentDetail;
    expect(submitted.status).toBe('review');
    expect(submitted.allowedActions).toEqual(['edit']);

    // The editor sees it in review and publishes it.
    const forEditor = (await editor.get(`/api/admin/content/${created.id}`).expect(200))
      .body as AdminContentDetail;
    expect(forEditor.allowedActions).toContain('publish');
    await editor
      .post(`/api/admin/content/${created.id}/publish`, { version: forEditor.version })
      .expect(200);
  });

  it('an author cannot see or edit another author’s material (404, not 403)', async () => {
    const author = await signedIn(ctx, 'author');
    const other = await signedIn(ctx, 'author', 'other@test.local');
    const created = await createArticle(author);

    await other.get(`/api/admin/content/${created.id}`).expect(404);
    await other
      .put(`/api/admin/content/${created.id}/draft`, { ...created.draft, version: created.version })
      .expect(404);
    const list = await other.get('/api/admin/content').expect(200);
    expect(list.body.total).toBe(0);
  });

  it('an author cannot manage taxonomy', async () => {
    const author = await signedIn(ctx, 'author');
    await author.post('/api/admin/categories', { name: 'X', slug: 'x' }).expect(403);
    await author.post('/api/admin/tags', { name: 'X', slug: 'x' }).expect(403);
  });
});

describe('scheduling', () => {
  it('the worker publishes scheduled articles when their time comes', async () => {
    const created = await createArticle(editor);
    const saved = await saveDraft(editor, created);
    const at = new Date(Date.now() + 3600_000);
    const scheduled = (
      await editor
        .post(`/api/admin/content/${created.id}/schedule`, {
          version: saved.version,
          scheduledAt: at.toISOString(),
        })
        .expect(200)
    ).body as AdminContentDetail;
    expect(scheduled.status).toBe('scheduled');
    await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(404);

    const service = ctx.app.get(ContentService);
    expect(await service.publishDueScheduled(new Date())).toBe(0);
    expect(await service.publishDueScheduled(new Date(at.getTime() + 1000))).toBe(1);

    const [row] = await ctx.db.select().from(content).where(eq(content.id, created.id));
    expect(row?.status).toBe('published');
    await ctx.http().get(`/api/v1/articles/${saved.draft.slug}`).expect(200);
  });

  it('rejects scheduling in the past', async () => {
    const created = await createArticle(editor);
    const saved = await saveDraft(editor, created);
    await editor
      .post(`/api/admin/content/${created.id}/schedule`, {
        version: saved.version,
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
      })
      .expect(422);
  });
});

describe('taxonomy rules', () => {
  it('limits categories to two levels and protects categories in use', async () => {
    const child = await editor
      .post('/api/admin/categories', { name: 'MikroTik', slug: 'mikrotik', parentId: categoryId })
      .expect(201);
    await editor
      .post('/api/admin/categories', {
        name: 'Deep',
        slug: 'deep',
        parentId: child.body.id as string,
      })
      .expect(422);
    await editor.delete(`/api/admin/categories/${categoryId}`).expect(409); // has a child

    const created = await createArticle(editor);
    await saveDraft(editor, created, { categoryId: child.body.id as string });
    await editor.delete(`/api/admin/categories/${child.body.id as string}`).expect(409); // used by a draft
  });

  it('rejects duplicate slugs with 409', async () => {
    await editor.post('/api/admin/tags', { name: 'DNS 2', slug: 'dns' }).expect(409);
  });
});
