import {
  type ArticleCard as Card,
  type Paginated,
  SLUG_PATTERN,
  type Tag,
  urls,
} from '@skytech/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArticleCard } from '@/components/site/article-card';
import { Breadcrumbs, PageHeading, Pagination } from '@/components/site/navigation';
import { publicApi } from '@/lib/api/server';
import { parsePage, plural } from '@/lib/utils';

const PAGE_SIZE = 12;
const load = cache(async (slug: string) =>
  SLUG_PATTERN.test(slug) ? publicApi<Tag>(`/v1/tags/${slug}`) : null,
);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await load((await params).slug);
  if (!tag) return {};
  return {
    title: `#${tag.name}`,
    description: tag.description || `Материалы с тегом ${tag.name}`,
    alternates: { canonical: urls.tag(tag.slug) },
    // Thin tag pages are not worth indexing.
    robots: tag.articleCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = await load((await params).slug);
  if (!tag || tag.articleCount === 0) notFound();
  const page = parsePage((await searchParams).page);
  const data = await publicApi<Paginated<Card>>(
    `/v1/articles?tag=${tag.slug}&page=${String(page)}&pageSize=${String(PAGE_SIZE)}`,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ name: 'Все статьи', path: '/articles' }, { name: `#${tag.name}` }]} />
      <div className="mt-6">
        <PageHeading
          eyebrow="Тег"
          title={`#${tag.name}`}
          description={
            tag.description ||
            `${String(tag.articleCount)} ${plural(tag.articleCount, ['материал', 'материала', 'материалов'])}`
          }
        />
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
      {data ? (
        <Pagination
          page={page}
          total={data.total}
          pageSize={PAGE_SIZE}
          href={(p) => (p > 1 ? `${urls.tag(tag.slug)}?page=${String(p)}` : urls.tag(tag.slug))}
        />
      ) : null}
    </div>
  );
}
