import { z } from 'zod';
import { slugSchema } from './common.js';

export const CATEGORY_MAX_DEPTH = 2;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  parentId: z.uuid().nullable().default(null),
  description: z.string().trim().max(1000).default(''),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  sortOrder: number;
  /** Published articles directly in this category (admin & public lists). */
  articleCount: number;
}

export interface CategoryTreeNode extends Category {
  children: Category[];
  /** `/category/{slug}` or `/category/{parent}/{slug}`. */
  path: string;
}

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(1000).default(''),
});
export type TagInput = z.infer<typeof tagInputSchema>;

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount: number;
}
