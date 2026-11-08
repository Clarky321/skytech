import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema/index.js';

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle; services accept `Db | Tx` so callers can compose transactions. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema, casing: 'snake_case' });
}

/** PostgreSQL error code helpers (constraint violations surface as 409s). */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  // drizzle wraps driver errors in `cause`
  for (let i = 0; i < 3 && current; i++) {
    if (typeof current === 'object' && 'code' in current) {
      const code = current.code;
      if (typeof code === 'string') return code;
    }
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
