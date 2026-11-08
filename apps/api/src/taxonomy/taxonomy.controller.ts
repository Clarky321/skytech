import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  categoryInputSchema,
  type CategoryInput,
  type CategoryTreeNode,
  slugSchema,
  type Tag,
  tagInputSchema,
  type TagInput,
} from '@skytech/contracts';
import { z } from 'zod';
import {
  type AuthUser,
  ClientIp,
  CurrentUser,
  Public,
  RequirePermission,
} from '../auth/decorators.js';
import { notFound } from '../platform/problem.js';
import { ZodPipe } from '../platform/zod.pipe.js';
import { TaxonomyService } from './taxonomy.service.js';

const idPipe = new ZodPipe(z.uuid());
const slugPipe = new ZodPipe(slugSchema);

/** Staff: read for everyone signed in (editor sidebar), write for taxonomy managers. */
@Controller('admin')
export class TaxonomyAdminController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get('categories')
  categories(): Promise<CategoryTreeNode[]> {
    return this.taxonomy.categoryTree();
  }

  @Post('categories')
  @RequirePermission('taxonomy.manage')
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(categoryInputSchema)) body: CategoryInput,
    @ClientIp() ip: string | null,
  ) {
    return this.taxonomy.createCategory(user, body, ip);
  }

  @Put('categories/:id')
  @RequirePermission('taxonomy.manage')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(categoryInputSchema)) body: CategoryInput,
    @ClientIp() ip: string | null,
  ) {
    return this.taxonomy.updateCategory(user, id, body, ip);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @RequirePermission('taxonomy.manage')
  async deleteCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.taxonomy.deleteCategory(user, id, ip);
  }

  @Get('tags')
  tags(): Promise<Tag[]> {
    return this.taxonomy.listTags();
  }

  @Post('tags')
  @RequirePermission('taxonomy.manage')
  createTag(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(tagInputSchema)) body: TagInput,
    @ClientIp() ip: string | null,
  ): Promise<Tag> {
    return this.taxonomy.createTag(user, body, ip);
  }

  @Put('tags/:id')
  @RequirePermission('taxonomy.manage')
  updateTag(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(tagInputSchema)) body: TagInput,
    @ClientIp() ip: string | null,
  ): Promise<Tag> {
    return this.taxonomy.updateTag(user, id, body, ip);
  }

  @Delete('tags/:id')
  @HttpCode(204)
  @RequirePermission('taxonomy.manage')
  async deleteTag(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.taxonomy.deleteTag(user, id, ip);
  }
}

@Public()
@Controller('v1')
export class TaxonomyPublicController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get('categories')
  categories(): Promise<CategoryTreeNode[]> {
    return this.taxonomy.categoryTree();
  }

  @Get('tags/:slug')
  async tag(@Param('slug', slugPipe) slug: string): Promise<Tag> {
    const tag = await this.taxonomy.tagBySlug(slug);
    if (!tag) throw notFound('Тег не найден');
    return tag;
  }
}
