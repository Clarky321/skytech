import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import { Redis } from 'ioredis';
import { Public } from '../auth/decorators.js';
import { DB, type Db } from './db.js';
import { REDIS } from './platform.module.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: the process is running. Never touches dependencies. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: critical dependencies answer. 503 if any of them does not. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([
      this.check(() => this.db.execute(sql`select 1`)),
      this.check(() => this.redis.ping()),
    ]);
    const ok = database === 'ok' && redis === 'ok';
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'unavailable', checks: { database, redis } };
  }

  private async check(fn: () => Promise<unknown>): Promise<'ok' | 'down'> {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('timeout'));
          }, 2000),
        ),
      ]);
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
