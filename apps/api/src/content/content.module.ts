import { Module } from '@nestjs/common';
import { AuthorsModule } from '../authors/authors.module.js';
import { MediaModule } from '../media/media.module.js';
import { TaxonomyModule } from '../taxonomy/taxonomy.module.js';
import { UsersModule } from '../users/users.module.js';
import { ContentAdminController, ContentPublicController } from './content.controller.js';
import { ContentQueryService } from './content-query.service.js';
import { ContentService } from './content.service.js';

@Module({
  imports: [TaxonomyModule, AuthorsModule, MediaModule, UsersModule],
  controllers: [ContentAdminController, ContentPublicController],
  providers: [ContentService, ContentQueryService],
  exports: [ContentService],
})
export class ContentModule {}
