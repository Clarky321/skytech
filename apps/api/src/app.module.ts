import { Module } from '@nestjs/common';

/**
 * Root module. Feature modules (platform, auth, content, …) are added phase by phase,
 * see docs/plan.md. Phase 0.1 only proves the HTTP stack boots.
 */
@Module({})
export class AppModule {}
