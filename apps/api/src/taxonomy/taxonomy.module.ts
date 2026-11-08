import { Module } from '@nestjs/common';
import { ContentStatsModule } from '../content/content-stats.service.js';
import { TaxonomyAdminController, TaxonomyPublicController } from './taxonomy.controller.js';
import { TaxonomyService } from './taxonomy.service.js';

@Module({
  imports: [ContentStatsModule],
  controllers: [TaxonomyAdminController, TaxonomyPublicController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
