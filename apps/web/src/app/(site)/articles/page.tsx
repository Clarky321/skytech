import { type ArticleCard as Card, type Paginated, urls } from '@skytech/contracts';
import type { Metadata } from 'next';
import { ArticleCard } from '@/components/site/article-card';
import { PageHeading, Pagination } from '@/components/site/navigation';
import { EmptyState } from '@/components/ui/misc';
import { publicApi } from '@/lib/api/server';
import { parsePage } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Все статьи',
  description: 'Все технические статьи и инструкции SkyTech.',
  alternates: { canonical: '/articles' },
};

const PAGE_SIZE = 12;

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = parsePage((await searchParams).page);
  const data = await publicApi<Paginated<Card>>(
    `/v1/articles?page=${String(page)}&pageSize=${String(PAGE_SIZE)}`,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Библиотека"
        title="Все статьи"
        description="Практические инструкции и разборы — от новых к старым."
      />
      <div className="mt-8">
        {data && data.items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Здесь пока пусто"
            description="Опубликованные статьи появятся на этой странице."
          />
        )}
      </div>
      {data ? (
        <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} href={urls.articles} />
      ) : null}
    </div>
  );
}
