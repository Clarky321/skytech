import type { CategoryTreeNode } from '@skytech/contracts';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { adminApi } from '@/lib/api/server';
import { CategoriesManager } from './categories-manager';

export const metadata: Metadata = { title: 'Категории' };

export default async function CategoriesPage() {
  const tree = await adminApi<CategoryTreeNode[]>('/admin/categories');
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Категории"
        description="Два уровня: раздел и подраздел. Адрес раздела: /category/раздел/подраздел."
      />
      <CategoriesManager tree={tree} />
    </div>
  );
}
