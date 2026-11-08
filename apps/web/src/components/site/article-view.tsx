import { type ArticleFull, urls } from '@skytech/contracts';
import { CalendarIcon, RefreshCwIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { ArticleBody } from './article-body';
import { ArticleRow, ReadingTime } from './article-card';
import { MediaImage } from './media-image';
import { Breadcrumbs } from './navigation';
import { TableOfContents } from './toc';

/** The article page. Shared by the public site and the admin preview, so preview == reality. */
export function ArticleView({ article }: { article: ArticleFull }) {
  const updated =
    new Date(article.updatedContentAt).getTime() - new Date(article.publishedAt).getTime() >
    24 * 3600 * 1000;
  const isPage = article.type === 'page';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:py-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <article className="min-w-0">
          <header className="max-w-3xl">
            {!isPage ? (
              <Breadcrumbs items={[...article.breadcrumbs, { name: article.title }]} />
            ) : null}
            <h1 className="mt-5 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-[2.6rem]">
              {article.title}
            </h1>
            {article.excerpt ? (
              <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">
                {article.excerpt}
              </p>
            ) : null}
            {!isPage ? (
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-3 text-sm text-muted-foreground">
                {article.author ? (
                  <Link
                    href={urls.author(article.author.slug)}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <UserIcon className="size-4 text-muted-foreground" aria-hidden />
                    {article.author.name}
                  </Link>
                ) : null}
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="size-4" aria-hidden />
                  <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                </span>
                {updated ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCwIcon className="size-4" aria-hidden />
                    обновлено{' '}
                    <time dateTime={article.updatedContentAt}>
                      {formatDate(article.updatedContentAt)}
                    </time>
                  </span>
                ) : null}
                <ReadingTime minutes={article.readingTimeMinutes} />
              </div>
            ) : null}
          </header>

          {article.cover ? (
            <figure className="mt-8 max-w-3xl overflow-hidden rounded-xl border bg-muted">
              <MediaImage
                media={article.cover}
                sizes="(min-width: 1024px) 768px, 100vw"
                priority
                className="w-full"
              />
            </figure>
          ) : null}

          {article.toc.length > 2 ? (
            <details className="mt-8 max-w-3xl rounded-lg border bg-card p-4 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">Содержание</summary>
              <div className="mt-3">
                <TableOfContents items={article.toc} />
              </div>
            </details>
          ) : null}

          <div className="mt-8 max-w-3xl">
            <ArticleBody html={article.html} />
          </div>

          {article.tags.length > 0 ? (
            <div className="mt-12 flex max-w-3xl flex-wrap gap-2" aria-label="Теги">
              {article.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={urls.tag(tag.slug)}
                  className="rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          ) : null}

          {article.author && article.author.bio ? (
            <aside
              className="mt-10 flex max-w-3xl gap-4 rounded-xl border bg-card p-5"
              aria-label="Об авторе"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {article.author.name.slice(0, 1)}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Автор</p>
                <Link
                  href={urls.author(article.author.slug)}
                  className="font-semibold hover:text-primary"
                >
                  {article.author.name}
                </Link>
                {article.author.jobTitle ? (
                  <p className="text-sm text-muted-foreground">{article.author.jobTitle}</p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed">{article.author.bio}</p>
              </div>
            </aside>
          ) : null}
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-22 space-y-8">
            <TableOfContents items={article.toc} />
            {article.related.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Похожие материалы
                </p>
                <div className="divide-y">
                  {article.related.map((r) => (
                    <ArticleRow key={r.id} article={r} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {article.related.length > 0 ? (
        <section className="border-t py-8 lg:hidden" aria-label="Похожие материалы">
          <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Похожие материалы
          </h2>
          <div className="mt-2 divide-y">
            {article.related.map((r) => (
              <ArticleRow key={r.id} article={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
