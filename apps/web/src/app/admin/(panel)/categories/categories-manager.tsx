'use client';

import { type Category, type CategoryTreeNode, slugify } from '@skytech/contracts';
import {
  CornerDownRightIcon,
  FolderTreeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useAdmin } from '@/components/admin/admin-context';
import { ConfirmDelete, useMutation } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';

type Editing = { mode: 'create'; parentId: string | null } | { mode: 'edit'; category: Category };

export function CategoriesManager({ tree }: { tree: CategoryTreeNode[] }) {
  const { can } = useAdmin();
  const manage = can('taxonomy.manage');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const row = (c: Category, child: boolean) => (
    <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
      {child ? (
        <CornerDownRightIcon className="ml-3 size-4 text-muted-foreground" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={child ? 'text-sm' : 'font-medium'}>{c.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{c.articleCount} опубл.</span>
      {manage ? (
        <div className="flex gap-1">
          {!child ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Подкатегория в «${c.name}»`}
              title="Добавить подкатегорию"
              onClick={() => {
                setEditing({ mode: 'create', parentId: c.id });
              }}
            >
              <PlusIcon />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Изменить «${c.name}»`}
            onClick={() => {
              setEditing({ mode: 'edit', category: c });
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Удалить «${c.name}»`}
            onClick={() => {
              setDeleting(c);
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      ) : null}
    </li>
  );

  return (
    <>
      {manage ? (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => {
              setEditing({ mode: 'create', parentId: null });
            }}
          >
            <PlusIcon /> Новая категория
          </Button>
        </div>
      ) : null}
      {tree.length === 0 ? (
        <EmptyState
          icon={<FolderTreeIcon />}
          title="Категорий пока нет"
          description="Создайте разделы сайта, например «Linux» или «Сети»."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {tree.map((root) => [row(root, false), ...root.children.map((c) => row(c, true))])}
        </ul>
      )}
      {editing ? (
        <CategoryDialog
          editing={editing}
          roots={tree}
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
          title={`Удалить «${deleting.name}»?`}
          description="Удалить можно только пустую категорию: без подкатегорий и материалов."
          path={`/admin/categories/${deleting.id}`}
          success="Категория удалена"
        />
      ) : null}
    </>
  );
}

function CategoryDialog({
  editing,
  roots,
  onClose,
}: {
  editing: Editing;
  roots: CategoryTreeNode[];
  onClose: () => void;
}) {
  const initial = editing.mode === 'edit' ? editing.category : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [parentId, setParentId] = useState(
    initial ? initial.parentId : editing.mode === 'create' ? editing.parentId : null,
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const { run, busy, errors } = useMutation();
  const hasChildren = initial
    ? roots.some((r) => r.id === initial.id && r.children.length > 0)
    : false;

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const body = { name, slug, parentId, description, sortOrder };
    const result = initial
      ? await run(`/admin/categories/${initial.id}`, 'PUT', body, 'Категория сохранена')
      : await run('/admin/categories', 'POST', body, 'Категория создана');
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
        <DialogHeader title={initial ? 'Изменить категорию' : 'Новая категория'} />
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <Field label="Название" htmlFor="cat-name" error={errors.name}>
            <Input
              id="cat-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field
            label="Slug"
            htmlFor="cat-slug"
            error={errors.slug}
            hint="Латиница, цифры и дефисы. Используется в адресе."
          >
            <Input
              id="cat-slug"
              value={slug}
              className="font-mono text-[13px]"
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugTouched(true);
              }}
            />
          </Field>
          <Field
            label="Родительская категория"
            htmlFor="cat-parent"
            error={errors.parentId}
            hint={
              hasChildren
                ? 'У категории есть подкатегории — она остаётся верхнего уровня.'
                : undefined
            }
          >
            <NativeSelect
              id="cat-parent"
              value={parentId ?? ''}
              disabled={hasChildren}
              onChange={(e) => {
                setParentId(e.target.value || null);
              }}
            >
              <option value="">— Верхний уровень —</option>
              {roots
                .filter((r) => r.id !== initial?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Описание" htmlFor="cat-desc" error={errors.description}>
            <Textarea
              id="cat-desc"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          </Field>
          <Field label="Порядок" htmlFor="cat-order" hint="Меньше — выше в меню.">
            <Input
              id="cat-order"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(Number(e.target.value) || 0);
              }}
              className="w-32"
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
