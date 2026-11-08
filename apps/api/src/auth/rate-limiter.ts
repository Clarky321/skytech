import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS } from '../platform/platform.module.js';
import { ProblemException } from '../platform/problem.js';

export interface Limit {
  key: string;
  max: number;
  windowSeconds: number;
}

/** Fixed-window counters in Redis. If Redis is down, limited endpoints answer 503. */
@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Throws 429 when any of the limits is already exhausted. Does not count the attempt. */
  async assertAllowed(limits: Limit[]): Promise<void> {
    const counts = await this.run(() => this.redis.mget(...limits.map((l) => `rl:${l.key}`)));
    for (const [i, limit] of limits.entries()) {
      if (Number(counts[i] ?? 0) >= limit.max) {
        const ttl = await this.run(() => this.redis.ttl(`rl:${limit.key}`));
        throw new ProblemException(
          HttpStatus.TOO_MANY_REQUESTS,
          `Слишком много попыток. Повторите через ${String(Math.max(1, Math.ceil(ttl / 60)))} мин.`,
        );
      }
    }
  }

  async hit(limits: Limit[]): Promise<void> {
    const pipeline = this.redis.multi();
    for (const limit of limits) {
      pipeline.incr(`rl:${limit.key}`);
      pipeline.expire(`rl:${limit.key}`, limit.windowSeconds, 'NX');
    }
    await this.run(() => pipeline.exec());
  }

  async reset(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.run(() => this.redis.del(...keys.map((k) => `rl:${k}`)));
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(`Redis unavailable for rate limiting: ${String(error)}`);
      throw new ProblemException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'Сервис временно недоступен. Попробуйте позже.',
      );
    }
  }
}
