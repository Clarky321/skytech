import {
  type AdminContentListItem,
  CONTENT_STATUS_LABELS,
  type ContentStatus,
  type CurrentUser,
  type Media,
  type Paginated,
} from '@skytech/contracts';
import { ArrowRightIcon, FilePlus2Icon, FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/server';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Обзор' };

const STATUSES: ContentStatus[] = ['draft', 'review', 'scheduled', 'published'];

export default async function DashboardPage() {
  const [user, recent, media, ...counts] = await Promise.all([
    adminApi<CurrentUser>('/admin/auth/me'),
    adminApi<Paginated<AdminContentListItem>>('/admin/content?pageSize=8'),
    adminApi<Paginated<Media>>('/admin/media?pageSize=1'),
    ...STATUSES.map((s) =>
      adminApi<Paginated<AdminContentListItem>>(`/admin/content?status=${s}&pageSize=1`),
    ),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title={`Здравствуйте, ${user.displayName}`}
        description="Состояние материалов и последние правки."
        actions={
          <Button asChild>
            <Link href="/admin/content/new">
              <FilePlus2Icon /> Новая статья
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((status, i) => (
          <Link
            key={status}
            href={`/admin/content?status=${status}`}
            className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <p className="text-sm text-muted-foreground">{CONTENT_STATUS_LABELS[status]}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{counts[i]?.total ?? 0}</p>
          </Link>
        ))}
        <Link
          href="/admin/media"
          className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <p className="text-sm text-muted-foreground">Медиафайлы</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{media.total}</p>
        </Link>
      </div>

      <section className="mt-8 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Недавно изменённые</h2>
          <Link
            href="/admin/content"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Все материалы <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        {recent.items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<FileTextIcon />}
              title="Материалов пока нет"
              description="Создайте первую статью — она появится здесь."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/content/new">Создать статью</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y">
            {recent.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/content/${item.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title || 'Без названия'}
                  </span>
                  <StatusBadge status={item.status} changed={item.hasUnpublishedChanges} />
                  <span className="w-40 text-right text-xs text-muted-foreground">
                    {formatDateTime(item.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
