import { type ArticleCard as Card, urls } from '@skytech/contracts';
import { ClockIcon } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, plural } from '@/lib/utils';
import { MediaImage } from './media-image';

export function ReadingTime({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <ClockIcon className="size-3.5" aria-hidden />
      {minutes} {plural(minutes, ['минута', 'минуты', 'минут'])}
    </span>
  );
}

export function ArticleCard({ article, featured = false }: { article: Card; featured?: boolean }) {
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40',
        featured && 'md:flex-row',
      )}
    >
      {article.cover ? (
        <div className={cn('overflow-hidden bg-muted', featured ? 'md:w-1/2' : 'aspect-[16/9]')}>
          <MediaImage
            media={article.cover}
            sizes={featured ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}
      <div className={cn('flex flex-1 flex-col p-5', featured && 'md:p-7')}>
        {article.category ? (
          <Link
            href={article.category.path}
            className="relative z-10 mb-2 w-fit text-xs font-semibold tracking-wide text-primary uppercase hover:underline"
          >
            {article.category.name}
          </Link>
        ) : null}
        <h3
          className={cn(
            'font-semibold tracking-tight text-balance',
            featured ? 'text-2xl leading-snug' : 'text-lg leading-snug',
          )}
        >
          <Link href={urls.article(article.slug)} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p
            className={cn(
              'mt-2 text-sm leading-relaxed text-muted-foreground',
              featured ? 'line-clamp-4' : 'line-clamp-3',
            )}
          >
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-muted-foreground">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span aria-hidden>·</span>
          <ReadingTime minutes={article.readingTimeMinutes} />
          {article.author ? (
            <>
              <span aria-hidden>·</span>
              <span>{article.author.name}</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Compact row for lists inside sidebars and "related" blocks. */
export function ArticleRow({ article }: { article: Card }) {
  return (
    <article className="group relative py-3">
      <h3 className="text-[15px] leading-snug font-medium group-hover:text-primary">
        <Link href={urls.article(article.slug)} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {article.category?.name ? `${article.category.name} · ` : ''}
        <ReadingTime minutes={article.readingTimeMinutes} />
      </p>
    </article>
  );
}
