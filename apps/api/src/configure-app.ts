import type { INestApplication } from '@nestjs/common';
import { API_ROOT } from '@skytech/contracts';

/**
 * HTTP-level settings shared by the real server (main.ts) and integration tests,
 * so tests exercise exactly the same app configuration.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_ROOT);
  app.enableShutdownHooks();
  return app;
}
