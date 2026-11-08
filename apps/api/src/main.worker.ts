import './load-env.js';
import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuditModule } from './audit/audit.module.js';
import { ContentModule } from './content/content.module.js';
import { ContentService } from './content/content.service.js';
import { loadConfig } from './platform/config.js';
import { PlatformModule } from './platform/platform.module.js';

const TICK_MS = 30_000;

/**
 * Background worker (ADR 0002): polls PostgreSQL for due work.
 * Today: publishes scheduled materials. Outbox consumers (cache revalidation, IndexNow,
 * search indexing) are added here in later phases.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();

  @Module({ imports: [PlatformModule.forRoot({ config }), AuditModule, ContentModule] })
  class WorkerModule {}

  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const logger = new Logger('Worker');
  const content = app.get(ContentService);

  let stopping = false;
  let running: Promise<void> = Promise.resolve();

  const tick = async () => {
    try {
      const published = await content.publishDueScheduled();
      if (published > 0) logger.log(`Published ${String(published)} scheduled material(s)`);
    } catch (error) {
      logger.error(`Scheduled publishing failed: ${String(error)}`);
    }
  };

  const loop = () => {
    if (stopping) return;
    running = tick().finally(() => {
      if (!stopping) setTimeout(loop, TICK_MS);
    });
  };

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.log(`${signal} received, finishing current tick…`);
    await running;
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.log(`Worker started, tick every ${String(TICK_MS / 1000)}s`);
  loop();
}

await bootstrap();
