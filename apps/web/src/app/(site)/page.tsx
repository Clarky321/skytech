import type { ArticleCard as Card, CategoryTreeNode, Paginated } from '@skytech/contracts';
import { ArrowRightIcon, FolderIcon } from 'lucide-react';
import Link from 'next/link';
import { ArticleCard } from '@/components/site/article-card';
import { EmptyState } from '@/components/ui/misc';
import { publicApi } from '@/lib/api/server';
import { plural } from '@/lib/utils';

export default async function HomePage() {
  const [latest, categories] = await Promise.all([
    publicApi<Paginated<Card>>('/v1/articles?pageSize=7'),
    publicApi<CategoryTreeNode[]>('/v1/categories'),
  ]);
  const [featured, ...rest] = latest?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="border-b py-12 sm:py-16">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">
          Технический портал
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl">
          Инструкции, которые работают в реальной инфраструктуре
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Windows Server и Active Directory, Linux, сети, виртуализация, мониторинг и резервное
          копирование — пошагово, с командами и проверками.
        </p>
      </section>

      <section className="py-10" aria-labelledby="latest">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-2xl font-bold tracking-tight">
            Свежие материалы
          </h2>
          <Link
            href="/articles"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Все статьи <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        {featured ? (
          <div className="grid gap-5">
            <ArticleCard article={featured} featured />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Пока нет опубликованных материалов"
            description="Первая статья появится здесь сразу после публикации."
          />
        )}
      </section>

      {categories && categories.length > 0 ? (
        <section className="border-t py-10" aria-labelledby="sections">
          <h2 id="sections" className="mb-6 text-2xl font-bold tracking-tight">
            Разделы
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => {
              const count = c.articleCount + c.children.reduce((s, ch) => s + ch.articleCount, 0);
              return (
                <Link
                  key={c.id}
                  href={c.path}
                  className="group flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center gap-2 font-semibold group-hover:text-primary">
                    <FolderIcon className="size-4 text-muted-foreground" aria-hidden />
                    {c.name}
                  </span>
                  {c.description ? (
                    <span className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {c.description}
                    </span>
                  ) : null}
                  <span className="mt-3 text-xs text-muted-foreground">
                    {count} {plural(count, ['материал', 'материала', 'материалов'])}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
