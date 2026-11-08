import type { Media, Paginated } from '@skytech/contracts';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { adminApi } from '@/lib/api/server';
import { parsePage } from '@/lib/utils';
import { MediaLibrary } from './media-library';

export const metadata: Metadata = { title: 'Медиафайлы' };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = parsePage((await searchParams).page);
  const data = await adminApi<Paginated<Media>>(`/admin/media?page=${String(page)}&pageSize=40`);
  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Медиафайлы"
        description="Изображения хранятся в S3 и перекодируются в WebP (640/1280/1920 px), метаданные EXIF удаляются."
      />
      <MediaLibrary data={data} page={page} />
    </div>
  );
}
