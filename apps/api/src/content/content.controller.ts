import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common';
import {
  type AdminContentDetail,
  type AdminContentListItem,
  type ArticleCard,
  type ArticleFull,
  type ArticleLookup,
  contentListQuerySchema,
  type ContentListQuery,
  createContentSchema,
  type CreateContentInput,
  type Paginated,
  pageQuerySchema,
  type RevisionSummary,
  saveDraftSchema,
  scheduleSchema,
  type ScheduleInput,
  slugSchema,
  versionedActionSchema,
  type VersionedActionInput,
} from '@skytech/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthorsService } from '../authors/authors.service.js';
import {
  type AuthUser,
  ClientIp,
  CurrentUser,
  Public,
  RequirePermission,
} from '../auth/decorators.js';
import { notFound } from '../platform/problem.js';
import { ZodPipe } from '../platform/zod.pipe.js';
import { TaxonomyService } from '../taxonomy/taxonomy.service.js';
import { ContentQueryService } from './content-query.service.js';
import { ContentService } from './content.service.js';

const idPipe = new ZodPipe(z.uuid());
const versionPipe = new ZodPipe(versionedActionSchema);
type SaveDraftBody = z.output<typeof saveDraftSchema>;

/**
 * Staff API. Route permissions are coarse; per-material rules (ownership, workflow state)
 * are enforced in ContentService via `allowedActions`.
 */
@Controller('admin/content')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(contentListQuerySchema)) query: ContentListQuery,
  ): Promise<Paginated<AdminContentListItem>> {
    return this.content.list(user, query);
  }

  @Post()
  @RequirePermission('content.create')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createContentSchema)) body: CreateContentInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.create(user, body, ip);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string): Promise<AdminContentDetail> {
    return this.content.get(user, id);
  }

  @Put(':id/draft')
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(saveDraftSchema)) body: SaveDraftBody,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.saveDraft(user, id, body, ip);
  }

  @Get(':id/preview')
  preview(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string): Promise<ArticleFull> {
    return this.content.preview(user, id);
  }

  @Get(':id/revisions')
  revisions(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
  ): Promise<RevisionSummary[]> {
    return this.content.revisions(user, id);
  }

  @Post(':id/revisions/:revisionId/restore')
  @HttpCode(200)
  restoreRevision(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Param('revisionId', idPipe) revisionId: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.restoreRevision(user, id, revisionId, body.version, ip);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('content.submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.submit(user, id, body.version, ip);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission('content.publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.publish(user, id, body.version, ip);
  }

  @Post(':id/schedule')
  @HttpCode(200)
  @RequirePermission('content.publish')
  schedule(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(scheduleSchema)) body: ScheduleInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.schedule(user, id, body.version, new Date(body.scheduledAt), ip);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @RequirePermission('content.publish')
  unpublish(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.unpublish(user, id, body.version, ip);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermission('content.publish')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.archive(user, id, body.version, ip);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermission('content.publish')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(versionPipe) body: VersionedActionInput,
    @ClientIp() ip: string | null,
  ): Promise<AdminContentDetail> {
    return this.content.restore(user, id, body.version, ip);
  }
}

const articleListQuery = pageQuerySchema.extend({
  category: slugSchema.optional(),
  tag: slugSchema.optional(),
  author: slugSchema.optional(),
});

/** Public, read-only. Only published revisions ever leave this controller. */
@Public()
@Controller('v1')
export class ContentPublicController {
  constructor(
    private readonly query: ContentQueryService,
    private readonly taxonomy: TaxonomyService,
    private readonly authors: AuthorsService,
  ) {}

  @Get('articles')
  async articles(
    @Query(new ZodPipe(articleListQuery)) q: z.infer<typeof articleListQuery>,
  ): Promise<Paginated<ArticleCard>> {
    const filter: { categoryIds?: string[]; tagId?: string; authorId?: string } = {};
    if (q.category) {
      const category = await this.taxonomy.categoryBySlug(q.category);
      filter.categoryIds = category ? [category.id, ...category.childIds] : [];
    }
    if (q.tag) {
      const tag = await this.taxonomy.tagBySlug(q.tag);
      if (!tag) return { items: [], page: q.page, pageSize: q.pageSize, total: 0 };
      filter.tagId = tag.id;
    }
    if (q.author) {
      const author = await this.authors.bySlug(q.author);
      if (!author) return { items: [], page: q.page, pageSize: q.pageSize, total: 0 };
      filter.authorId = author.id;
    }
    return this.query.listPublished(q.page, q.pageSize, filter);
  }

  @Get('articles/:slug')
  article(
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ArticleLookup> {
    return this.lookup('article', slug, res);
  }

  @Get('pages/:slug')
  page(
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ArticleLookup> {
    return this.lookup('page', slug, res);
  }

  @Get('categories/:slug')
  async category(@Param('slug', new ZodPipe(slugSchema)) slug: string) {
    const category = await this.taxonomy.categoryBySlug(slug);
    if (!category) throw notFound('Категория не найдена');
    const tree = await this.taxonomy.categoryTree();
    const root = tree.find((c) => c.id === (category.parentId ?? category.id));
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      path: category.path,
      parent: category.parent
        ? { name: category.parent.name, slug: category.parent.slug, path: root?.path ?? '' }
        : null,
      children: category.parentId ? [] : (root?.children ?? []),
    };
  }

  private async lookup(
    type: 'article' | 'page',
    slug: string,
    res: Response,
  ): Promise<ArticleLookup> {
    const result = await this.query.lookup(type, slug);
    if (!result) throw notFound('Материал не найден');
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }
}
