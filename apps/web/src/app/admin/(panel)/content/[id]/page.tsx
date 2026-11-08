import type { AdminContentDetail, Author, CategoryTreeNode, Tag } from '@skytech/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentEditor } from '@/components/admin/editor/content-editor';
import { adminApi, adminApiOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Редактор' };

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, categories, authors, tags] = await Promise.all([
    adminApiOrNull<AdminContentDetail>(`/admin/content/${id}`),
    adminApi<CategoryTreeNode[]>('/admin/categories'),
    adminApi<Author[]>('/admin/authors'),
    adminApi<Tag[]>('/admin/tags'),
  ]);
  if (!detail) notFound();
  // `key` remounts the editor if another material is opened from this one.
  return (
    <ContentEditor
      key={detail.id}
      initial={detail}
      categories={categories}
      authors={authors}
      tags={tags}
    />
  );
}
