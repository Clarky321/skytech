import type { ArticleFull } from '@skytech/contracts';
import { EyeIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/site/article-view';
import { SiteShell } from '@/components/site/shell';
import { adminApiOrNull } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'Предпросмотр',
  robots: { index: false, follow: false },
};

/** The saved draft rendered with the public page components (staff only: the API checks the session). */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const article = await adminApiOrNull<ArticleFull>(`/admin/content/${id}/preview`);
  if (!article) notFound();

  return (
    <SiteShell>
      <div className="border-b border-warning/40 bg-warning/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm sm:px-6">
          <EyeIcon className="size-4" aria-hidden />
          <span>
            <strong>Предпросмотр черновика.</strong> Так материал будет выглядеть после публикации.
            Страница не видна посетителям.
          </span>
          <Link href={`/admin/content/${id}`} className="ml-auto font-medium underline">
            Вернуться в редактор
          </Link>
        </div>
      </div>
      <ArticleView article={article} />
    </SiteShell>
  );
}
