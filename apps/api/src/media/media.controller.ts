import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type Media,
  MEDIA_MAX_BYTES,
  mediaUpdateSchema,
  type MediaUpdateInput,
  type Paginated,
  pageQuerySchema,
} from '@skytech/contracts';
import { z } from 'zod';
import { type AuthUser, ClientIp, CurrentUser, RequirePermission } from '../auth/decorators.js';
import { ZodPipe } from '../platform/zod.pipe.js';
import { MediaService, type UploadedFile as UploadedFileData } from './media.service.js';

const listQuerySchema = pageQuerySchema.extend({ q: z.string().trim().max(200).optional() });
const idPipe = new ZodPipe(z.uuid());

@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RequirePermission('media.upload')
  @UseInterceptors(
    // No `dest` → multer keeps the file in memory; it is never written to the app's disk.
    // Oversized uploads are rejected by multer with 413 before reaching the service.
    FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_BYTES, files: 1, fields: 5 } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileData | undefined,
    @ClientIp() ip: string | null,
  ): Promise<Media> {
    return this.media.upload(user, file, ip);
  }

  @Get()
  @RequirePermission('media.upload')
  list(
    @Query(new ZodPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ): Promise<Paginated<Media>> {
    return this.media.list(query);
  }

  @Get(':id')
  @RequirePermission('media.upload')
  get(@Param('id', idPipe) id: string): Promise<Media> {
    return this.media.get(id);
  }

  @Patch(':id')
  @RequirePermission('media.upload')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(mediaUpdateSchema)) body: MediaUpdateInput,
    @ClientIp() ip: string | null,
  ): Promise<Media> {
    return this.media.updateAlt(user, id, body.alt, ip);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('media.delete')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.media.delete(user, id, ip);
  }
}
