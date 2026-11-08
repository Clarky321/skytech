import {
  type ArticleCard as Card,
  type Author,
  type Paginated,
  SLUG_PATTERN,
  urls,
} from '@skytech/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArticleCard } from '@/components/site/article-card';
import { Breadcrumbs, Pagination } from '@/components/site/navigation';
import { EmptyState } from '@/components/ui/misc';
import { publicApi } from '@/lib/api/server';
import { parsePage, plural } from '@/lib/utils';

const PAGE_SIZE = 12;
const load = cache(async (slug: string) =>
  SLUG_PATTERN.test(slug) ? publicApi<Author>(`/v1/authors/${slug}`) : null,
);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const author = await load((await params).slug);
  if (!author) return {};
  return {
    title: author.name,
    description: author.bio || `Статьи автора ${author.name}`,
    alternates: { canonical: urls.author(author.slug) },
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const author = await load((await params).slug);
  if (!author) notFound();
  const page = parsePage((await searchParams).page);
  const data = await publicApi<Paginated<Card>>(
    `/v1/articles?author=${author.slug}&page=${String(page)}&pageSize=${String(PAGE_SIZE)}`,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ name: 'Авторы' }, { name: author.name }]} />
      <header className="mt-6 flex flex-col gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
          {author.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{author.name}</h1>
          {author.jobTitle ? <p className="text-muted-foreground">{author.jobTitle}</p> : null}
          {author.bio ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed">{author.bio}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {author.articleCount}{' '}
            {plural(author.articleCount, ['публикация', 'публикации', 'публикаций'])}
          </p>
        </div>
      </header>
      <div className="mt-8">
        {data && data.items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="У автора пока нет опубликованных материалов" />
        )}
      </div>
      {data ? (
        <Pagination
          page={page}
          total={data.total}
          pageSize={PAGE_SIZE}
          href={(p) =>
            p > 1 ? `${urls.author(author.slug)}?page=${String(p)}` : urls.author(author.slug)
          }
        />
      ) : null}
    </div>
  );
}
