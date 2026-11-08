import { type ArticleLookup, RESERVED_PAGE_SLUGS, SLUG_PATTERN, urls } from '@skytech/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ArticleView } from '@/components/site/article-view';
import { publicApi } from '@/lib/api/server';

/** Static pages (`type = page`) live at the site root: /about, /privacy, … */
const lookup = cache(async (slug: string) =>
  SLUG_PATTERN.test(slug) && !(RESERVED_PAGE_SLUGS as readonly string[]).includes(slug)
    ? publicApi<ArticleLookup>(`/v1/pages/${slug}`)
    : null,
);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await lookup((await params).slug);
  if (result?.kind !== 'article') return {};
  const p = result.article;
  return {
    title: p.seoTitle || p.title,
    description: p.seoDescription || p.excerpt,
    alternates: { canonical: urls.page(p.slug) },
  };
}

export default async function StaticPage({ params }: Props) {
  const result = await lookup((await params).slug);
  if (!result) notFound();
  if (result.kind === 'redirect') permanentRedirect(result.location);
  return <ArticleView article={result.article} />;
}
