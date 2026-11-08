import { Module } from '@nestjs/common';
import { ContentStatsModule } from '../content/content-stats.service.js';
import { AuthorsAdminController, AuthorsPublicController } from './authors.controller.js';
import { AuthorsService } from './authors.service.js';

@Module({
  imports: [ContentStatsModule],
  controllers: [AuthorsAdminController, AuthorsPublicController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
