'use client';

import { slugify, type Tag } from '@skytech/contracts';
import { PencilIcon, PlusIcon, TagsIcon, Trash2Icon } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useAdmin } from '@/components/admin/admin-context';
import { ConfirmDelete, useMutation } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';

export function TagsManager({ tags }: { tags: Tag[] }) {
  const { can } = useAdmin();
  const manage = can('taxonomy.manage');
  const [editing, setEditing] = useState<Tag | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [filter, setFilter] = useState('');
  const visible = tags.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
          placeholder="Фильтр"
          aria-label="Фильтр тегов"
          className="w-60"
        />
        {manage ? (
          <Button
            className="ml-auto"
            onClick={() => {
              setEditing('new');
            }}
          >
            <PlusIcon /> Новый тег
          </Button>
        ) : null}
      </div>
      {tags.length === 0 ? (
        <EmptyState icon={<TagsIcon />} title="Тегов пока нет" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Название</th>
                <th className="px-4 py-2.5 font-medium">Slug</th>
                <th className="px-4 py-2.5 text-right font-medium">Опубликовано</th>
                {manage ? <th className="w-24" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.slug}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.articleCount}</td>
                  {manage ? (
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Изменить ${t.name}`}
                        onClick={() => {
                          setEditing(t);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Удалить ${t.name}`}
                        onClick={() => {
                          setDeleting(t);
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <TagDialog
          tag={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(o) => {
            if (!o) setDeleting(null);
          }}
          title={`Удалить тег «${deleting.name}»?`}
          description="Тег, который используется в материалах, удалить нельзя — сначала уберите его из статей."
          path={`/admin/tags/${deleting.id}`}
          success="Тег удалён"
        />
      ) : null}
    </>
  );
}

function TagDialog({ tag, onClose }: { tag: Tag | null; onClose: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [slug, setSlug] = useState(tag?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(tag));
  const [description, setDescription] = useState(tag?.description ?? '');
  const { run, busy, errors } = useMutation();

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const body = { name, slug, description };
    const result = tag
      ? await run(`/admin/tags/${tag.id}`, 'PUT', body, 'Тег сохранён')
      : await run('/admin/tags', 'POST', body, 'Тег создан');
    if (result) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader title={tag ? 'Изменить тег' : 'Новый тег'} />
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <Field label="Название" htmlFor="tag-name" error={errors.name}>
            <Input
              id="tag-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" htmlFor="tag-slug" error={errors.slug}>
            <Input
              id="tag-slug"
              value={slug}
              className="font-mono text-[13px]"
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugTouched(true);
              }}
            />
          </Field>
          <Field label="Описание" htmlFor="tag-desc" error={errors.description}>
            <Textarea
              id="tag-desc"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : null} Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
