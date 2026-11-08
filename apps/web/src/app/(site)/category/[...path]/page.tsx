import {
  type ArticleCard as Card,
  type Category,
  type Paginated,
  SLUG_PATTERN,
} from '@skytech/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ArticleCard } from '@/components/site/article-card';
import { Breadcrumbs, PageHeading, Pagination } from '@/components/site/navigation';
import { EmptyState } from '@/components/ui/misc';
import { publicApi } from '@/lib/api/server';
import { parsePage } from '@/lib/utils';

interface CategoryPage {
  id: string;
  name: string;
  slug: string;
  description: string;
  path: string;
  parent: { name: string; slug: string; path: string } | null;
  children: Category[];
}

const PAGE_SIZE = 12;
const load = cache(async (slug: string) => publicApi<CategoryPage>(`/v1/categories/${slug}`));

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `/category/{slug}` or `/category/{parent}/{slug}`; the last segment identifies the category. */
async function resolve(path: string[]) {
  if (path.length === 0 || path.length > 2 || !path.every((s) => SLUG_PATTERN.test(s))) return null;
  const category = await load(path[path.length - 1] ?? '');
  return category;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await resolve((await params).path);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description || `Статьи раздела «${category.name}»`,
    alternates: { canonical: category.path },
  };
}

export default async function CategoryPageView({ params, searchParams }: Props) {
  const { path } = await params;
  const category = await resolve(path);
  if (!category) notFound();
  // Canonical path (e.g. /category/mikrotik → /category/networks/mikrotik).
  if (`/category/${path.join('/')}` !== category.path) permanentRedirect(category.path);

  const page = parsePage((await searchParams).page);
  const data = await publicApi<Paginated<Card>>(
    `/v1/articles?category=${category.slug}&page=${String(page)}&pageSize=${String(PAGE_SIZE)}`,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          ...(category.parent ? [{ name: category.parent.name, path: category.parent.path }] : []),
          { name: category.name },
        ]}
      />
      <div className="mt-6">
        <PageHeading eyebrow="Раздел" title={category.name} description={category.description} />
      </div>
      {category.children.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <Link
              key={c.id}
              href={`${category.path}/${c.slug}`}
              className="rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:border-primary/50 hover:text-primary"
            >
              {c.name}
              <span className="ml-1.5 text-muted-foreground">{c.articleCount}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-8">
        {data && data.items.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="В этом разделе пока нет статей" />
        )}
      </div>
      {data ? (
        <Pagination
          page={page}
          total={data.total}
          pageSize={PAGE_SIZE}
          href={(p) => (p > 1 ? `${category.path}?page=${String(p)}` : category.path)}
        />
      ) : null}
    </div>
  );
}
