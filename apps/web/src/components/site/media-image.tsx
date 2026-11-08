import type { MediaRef } from '@skytech/contracts';

/** Responsive image from a MediaRef: srcset, real dimensions (no layout shift), lazy by default. */
export function MediaImage({
  media,
  alt,
  sizes,
  className,
  priority = false,
}: {
  media: MediaRef;
  alt?: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- renditions are pre-generated in S3
    <img
      src={media.url}
      srcSet={media.sources.map((s) => `${s.url} ${String(s.width)}w`).join(', ')}
      sizes={sizes}
      width={media.width}
      height={media.height}
      alt={alt ?? media.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}
