import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ProblemException } from './problem.js';

/**
 * Validates and transforms a request part with a contract schema from @skytech/contracts.
 * Usage: `@Body(new ZodPipe(saveDraftSchema)) body: SaveDraftInput`.
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const errors = result.error.issues.slice(0, 50).map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    throw new ProblemException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Данные не прошли проверку',
      errors,
    );
  }
}
