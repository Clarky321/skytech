import { Injectable } from '@nestjs/common';
import { outboxEvents } from '../db/schema/index.js';
import type { DbOrTx } from '../platform/db.js';

export type OutboxEventType = 'content.published' | 'content.unpublished';

/**
 * Transactional outbox: side effects (cache revalidation, IndexNow, search indexing) are
 * recorded in the same transaction as the change and processed later by the worker.
 */
@Injectable()
export class OutboxService {
  async add(tx: DbOrTx, type: OutboxEventType, payload: Record<string, unknown>): Promise<void> {
    await tx.insert(outboxEvents).values({ type, payload });
  }
}
