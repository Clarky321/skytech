import type { Author } from '@skytech/contracts';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { adminApi } from '@/lib/api/server';
import { AuthorsManager } from './authors-manager';

export const metadata: Metadata = { title: 'Авторы' };

export default async function AuthorsPage() {
  const authors = await adminApi<Author[]>('/admin/authors');
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Авторы"
        description="Публичные профили авторов: показываются в статьях и на страницах /authors/slug."
      />
      <AuthorsManager authors={authors} />
    </div>
  );
}
