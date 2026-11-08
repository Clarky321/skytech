import { type DynamicModule, Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthorsModule } from './authors/authors.module.js';
import { ContentModule } from './content/content.module.js';
import { MediaModule } from './media/media.module.js';
import type { AppConfig } from './platform/config.js';
import { HealthController } from './platform/health.controller.js';
import { PlatformModule } from './platform/platform.module.js';
import { TaxonomyModule } from './taxonomy/taxonomy.module.js';

/** HTTP API composition root. `config` is injectable for tests. */
@Module({})
export class AppModule {
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(config ? { config } : {}),
        AuditModule,
        AuthModule,
        MediaModule,
        TaxonomyModule,
        AuthorsModule,
        ContentModule,
      ],
      controllers: [HealthController],
    };
  }
}
