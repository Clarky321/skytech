import { Injectable } from '@nestjs/common';
import { auditLog } from '../db/schema/index.js';
import type { DbOrTx } from '../platform/db.js';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Meaningful, small diff. Must never contain passwords, tokens, cookies or secrets. */
  diff?: Record<string, unknown>;
  ip?: string | null;
}

const FORBIDDEN_KEYS = /pass(word)?|token|secret|cookie|hash/i;

/** Writes audit entries inside the caller's transaction so they commit or roll back together. */
@Injectable()
export class AuditService {
  async record(tx: DbOrTx, entry: AuditEntry): Promise<void> {
    await tx.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      diff: scrub(entry.diff ?? {}),
      ip: entry.ip ?? null,
    });
  }
}

/** Defence in depth: drop sensitive-looking keys even if a caller passes them by mistake. */
export function scrub(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    out[key] =
      v && typeof v === 'object' && !Array.isArray(v) ? scrub(v as Record<string, unknown>) : v;
  }
  return out;
}
