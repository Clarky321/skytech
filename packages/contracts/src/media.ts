import { z } from 'zod';

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type MediaMime = (typeof MEDIA_ALLOWED_MIME)[number];

/** Responsive widths generated for every image (only those ≤ the original width). */
export const MEDIA_VARIANT_WIDTHS = [640, 1280, 1920] as const;

export interface MediaVariant {
  /** Object key inside the bucket, e.g. `media/<id>/1280.webp`. */
  key: string;
  width: number;
  height: number;
}

export interface Media {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  /** Largest stored rendition (`full`), always present. */
  full: MediaVariant;
  /** Narrower renditions, ascending by width. */
  variants: MediaVariant[];
  createdAt: string;
}

export const mediaUpdateSchema = z.object({
  alt: z.string().trim().max(300),
});
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

export function mediaUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`;
}
