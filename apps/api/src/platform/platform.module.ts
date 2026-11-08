import { randomUUID } from 'node:crypto';
import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  type DynamicModule,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import type pg from 'pg';
import { APP_CONFIG, type AppConfig, loadConfig } from './config.js';
import { DB, PG_POOL, createDb, createPool } from './db.js';

export const REDIS = Symbol('REDIS');

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Global infrastructure: validated config, PostgreSQL (drizzle), Redis and structured logging.
 * `PlatformModule.forRoot()` is imported once by each entry point (HTTP, worker, CLI).
 */
@Global()
@Module({})
export class PlatformModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  static forRoot(options: { config?: AppConfig; http?: boolean } = {}): DynamicModule {
    const config = options.config ?? loadConfig();
    return {
      module: PlatformModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.LOG_LEVEL,
            // Correlate every log line of a request; accept a sane incoming id from the proxy.
            genReqId: (req, res) => {
              const incoming = req.headers['x-request-id'];
              const id =
                typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
                  ? incoming
                  : randomUUID();
              res.setHeader('X-Request-Id', id);
              return id;
            },
            customAttributeKeys: { reqId: 'request_id' },
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers.authorization',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            autoLogging: {
              ignore: (req) => req.url?.startsWith('/api/health') ?? false,
            },
            ...(config.NODE_ENV === 'development'
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                  },
                }
              : {}),
          },
        }),
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: PG_POOL, useFactory: () => createPool(config.DATABASE_URL) },
        { provide: DB, inject: [PG_POOL], useFactory: createDb },
        {
          provide: REDIS,
          useFactory: () =>
            new Redis(config.REDIS_URL, {
              // Fail fast instead of queueing: callers turn errors into 503 responses.
              maxRetriesPerRequest: 1,
              enableOfflineQueue: false,
              lazyConnect: false,
            }),
        },
      ],
      exports: [APP_CONFIG, PG_POOL, DB, REDIS],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
    await this.pool.end();
  }
}
