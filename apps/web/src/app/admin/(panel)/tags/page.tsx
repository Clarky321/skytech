import type { Tag } from '@skytech/contracts';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { adminApi } from '@/lib/api/server';
import { TagsManager } from './tags-manager';

export const metadata: Metadata = { title: 'Теги' };

export default async function TagsPage() {
  const tags = await adminApi<Tag[]>('/admin/tags');
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Теги"
        description="Конкретные технологии и темы: nginx, DNS, PowerShell. Страницы тегов: /tags/slug."
      />
      <TagsManager tags={tags} />
    </div>
  );
}
