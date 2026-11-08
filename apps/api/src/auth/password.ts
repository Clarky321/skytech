import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Argon2id is the library default (its `Algorithm` const enum cannot be imported with
// isolatedModules); password.test.ts asserts the `$argon2id$` prefix.
// OWASP-recommended parameters: 19 MiB, 2 iterations, 1 lane.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Hash used when the email is unknown, so a failed login costs the same time either way
 * (no user enumeration through timing).
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

/** Random password for CLI-created accounts: 20 chars, URL-safe alphabet. */
export function generatePassword(): string {
  return randomBytes(15).toString('base64url');
}
