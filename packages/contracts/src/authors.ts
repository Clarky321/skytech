import { z } from 'zod';
import { slugSchema } from './common.js';

export const authorInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  jobTitle: z.string().trim().max(160).default(''),
  bio: z.string().trim().max(2000).default(''),
  avatarMediaId: z.uuid().nullable().default(null),
  /** Optional link to a staff account (the account's own profile). */
  userId: z.uuid().nullable().default(null),
});
export type AuthorInput = z.infer<typeof authorInputSchema>;

export interface Author {
  id: string;
  name: string;
  slug: string;
  jobTitle: string;
  bio: string;
  avatarMediaId: string | null;
  userId: string | null;
  articleCount: number;
}
