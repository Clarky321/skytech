import {
  type AdminContentListItem,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUSES,
  type ContentStatus,
  type Paginated,
} from '@skytech/contracts';
import { FilePlus2Icon, FileTextIcon, SearchIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/site/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/server';
import { cn, formatDateTime, parsePage } from '@/lib/utils';

export const metadata: Metadata = { title: 'Материалы' };

const PAGE_SIZE = 20;
type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ContentListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const type = one(params.type) === 'page' ? 'page' : 'article';
  const statusParam = one(params.status);
  const status = (CONTENT_STATUSES as readonly string[]).includes(statusParam ?? '')
    ? (statusParam as ContentStatus)
    : undefined;
  const q = one(params.q)?.trim().slice(0, 200) ?? '';
  const page = parsePage(params.page);

  const query = new URLSearchParams({ type, page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) query.set('status', status);
  if (q) query.set('q', q);
  const data = await adminApi<Paginated<AdminContentListItem>>(
    `/admin/content?${query.toString()}`,
  );

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      type: type === 'page' ? 'page' : undefined,
      status,
      q: q || undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/admin/content?${s}` : '/admin/content';
  };
  const isPage = type === 'page';

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title={isPage ? 'Страницы' : 'Статьи'}
        description={
          isPage
            ? 'Статические страницы сайта: «О проекте», «Контакты» и т. п.'
            : 'Технические статьи и инструкции.'
        }
        actions={
          <Button asChild>
            <Link href={`/admin/content/new${isPage ? '?type=page' : ''}`}>
              <FilePlus2Icon /> {isPage ? 'Новая страница' : 'Новая статья'}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Фильтр по статусу"
          className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {[undefined, ...CONTENT_STATUSES].map((s) => (
            <Link
              key={s ?? 'all'}
              href={href({ status: s, page: undefined })}
              aria-current={s === status ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                s === status
                  ? 'bg-background font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s ? CONTENT_STATUS_LABELS[s] : 'Все'}
            </Link>
          ))}
        </nav>
        <form className="relative ml-auto w-full sm:w-72" role="search">
          {isPage ? <input type="hidden" name="type" value="page" /> : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Поиск по заголовку"
            className="pl-8"
            aria-label="Поиск по заголовку"
          />
        </form>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title={
            q || status ? 'Ничего не найдено' : isPage ? 'Страниц пока нет' : 'Статей пока нет'
          }
          description={
            q || status ? 'Измените фильтр или поисковый запрос.' : 'Создайте первый материал.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Заголовок</th>
                <th className="px-4 py-2.5 font-medium">Статус</th>
                {!isPage ? (
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Категория</th>
                ) : null}
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Автор</th>
                <th className="px-4 py-2.5 text-right font-medium">Изменено</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((item) => (
                <tr key={item.id} className="group hover:bg-muted/40">
                  <td className="max-w-md px-4 py-3">
                    <Link
                      href={`/admin/content/${item.id}`}
                      className="block truncate font-medium group-hover:text-primary"
                    >
                      {item.title || 'Без названия'}
                    </Link>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      /{item.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} changed={item.hasUnpublishedChanges} />
                  </td>
                  {!isPage ? (
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {item.category?.name ?? '—'}
                    </td>
                  ) : null}
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {item.author?.name ?? item.createdBy?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-muted-foreground">
                    {formatDateTime(item.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        total={data.total}
        pageSize={PAGE_SIZE}
        href={(p) => href({ page: p > 1 ? String(p) : undefined })}
      />
    </div>
  );
}
