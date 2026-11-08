import { type ArticleLookup, SLUG_PATTERN, urls } from '@skytech/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ArticleView } from '@/components/site/article-view';
import { publicApi } from '@/lib/api/server';

// One API call per request even though metadata and the page both need the article.
const lookup = cache(async (slug: string) =>
  SLUG_PATTERN.test(slug) ? publicApi<ArticleLookup>(`/v1/articles/${slug}`) : null,
);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await lookup((await params).slug);
  if (result?.kind !== 'article') return {};
  const a = result.article;
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt;
  return {
    title,
    description,
    alternates: { canonical: urls.article(a.slug) },
    openGraph: {
      type: 'article',
      title,
      description,
      url: urls.article(a.slug),
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedContentAt,
      ...(a.cover
        ? { images: [{ url: a.cover.url, width: a.cover.width, height: a.cover.height }] }
        : {}),
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const result = await lookup((await params).slug);
  if (!result) notFound();
  // Renamed article: the old URL keeps working via a permanent (308/301) redirect.
  if (result.kind === 'redirect') permanentRedirect(result.location);
  return <ArticleView article={result.article} />;
}
