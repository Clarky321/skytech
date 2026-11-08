import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_ROOT } from '@skytech/contracts';
import { ProblemDetailsFilter } from './platform/problem.filter.js';

/**
 * HTTP-level settings shared by the real server (main.ts) and integration tests,
 * so tests exercise exactly the same app configuration.
 */
export function configureApp<T extends NestExpressApplication>(app: T): T {
  app.setGlobalPrefix(API_ROOT);
  app.useGlobalFilters(new ProblemDetailsFilter());
  // Documents can be large; everything else is small. Uploads use multipart (own limit).
  app.useBodyParser('json', { limit: '2mb' });
  // nginx (production) and the Next.js dev rewrite run on the same host.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  return app;
}
