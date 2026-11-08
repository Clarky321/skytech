import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { type Author, authorInputSchema, type AuthorInput, slugSchema } from '@skytech/contracts';
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
import { AuthorsService } from './authors.service.js';

const idPipe = new ZodPipe(z.uuid());

@Controller('admin/authors')
export class AuthorsAdminController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  list(): Promise<Author[]> {
    return this.authors.list();
  }

  @Post()
  @RequirePermission('authors.manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(authorInputSchema)) body: AuthorInput,
    @ClientIp() ip: string | null,
  ): Promise<Author> {
    return this.authors.create(user, body, ip);
  }

  @Put(':id')
  @RequirePermission('authors.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(authorInputSchema)) body: AuthorInput,
    @ClientIp() ip: string | null,
  ): Promise<Author> {
    return this.authors.update(user, id, body, ip);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('authors.manage')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.authors.delete(user, id, ip);
  }
}

@Public()
@Controller('v1/authors')
export class AuthorsPublicController {
  constructor(private readonly authors: AuthorsService) {}

  @Get(':slug')
  async bySlug(@Param('slug', new ZodPipe(slugSchema)) slug: string): Promise<Author> {
    const author = await this.authors.bySlug(slug);
    if (!author) throw notFound('Автор не найден');
    return author;
  }
}
