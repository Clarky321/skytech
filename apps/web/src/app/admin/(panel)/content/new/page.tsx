import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { NewContentForm } from './new-content-form';

export const metadata: Metadata = { title: 'Новый материал' };

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const type = (await searchParams).type === 'page' ? 'page' : 'article';
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPageHeader
        title={type === 'page' ? 'Новая страница' : 'Новая статья'}
        description="Задайте название — дальше откроется редактор. Черновик видите только вы и редакторы."
      />
      <NewContentForm type={type} />
    </div>
  );
}
