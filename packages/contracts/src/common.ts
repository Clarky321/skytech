import { z } from 'zod';

export const uuidSchema = z.uuid();

/** Latin, digits, single hyphens between words. Used for every public URL segment. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 120;

export const slugSchema = z
  .string()
  .min(1, 'Slug обязателен')
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'Только латиница, цифры и дефисы между словами');

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** RFC 9457 Problem Details, the single error format of the API. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Field-level validation errors (422). */
  errors?: { path: string; message: string }[];
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'title' in value &&
    typeof (value as { status: unknown }).status === 'number'
  );
}
