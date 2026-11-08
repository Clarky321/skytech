'use client';

import { type Author, slugify, urls } from '@skytech/contracts';
import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useAdmin } from '@/components/admin/admin-context';
import { ConfirmDelete, useMutation } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';

export function AuthorsManager({ authors }: { authors: Author[] }) {
  const { can, user } = useAdmin();
  const manage = can('authors.manage');
  const [editing, setEditing] = useState<Author | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Author | null>(null);

  return (
    <>
      {manage ? (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => {
              setEditing('new');
            }}
          >
            <PlusIcon /> Новый автор
          </Button>
        </div>
      ) : null}
      {authors.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="Авторов пока нет"
          description="Без автора статью нельзя опубликовать."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {authors.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {a.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.name}
                  {a.userId === user.id ? (
                    <span className="ml-2 text-xs text-primary">это вы</span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{a.jobTitle || '—'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.articleCount} опубликовано</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button asChild variant="ghost" size="icon-sm" aria-label="Страница автора">
                  <a href={urls.author(a.slug)} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon />
                  </a>
                </Button>
                {manage ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Изменить ${a.name}`}
                      onClick={() => {
                        setEditing(a);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Удалить ${a.name}`}
                      onClick={() => {
                        setDeleting(a);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <AuthorDialog
          author={editing === 'new' ? null : editing}
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
          title={`Удалить автора «${deleting.name}»?`}
          description="Автора, указанного в материалах, удалить нельзя."
          path={`/admin/authors/${deleting.id}`}
          success="Автор удалён"
        />
      ) : null}
    </>
  );
}

function AuthorDialog({ author, onClose }: { author: Author | null; onClose: () => void }) {
  const { user } = useAdmin();
  const [name, setName] = useState(author?.name ?? '');
  const [slug, setSlug] = useState(author?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(author));
  const [jobTitle, setJobTitle] = useState(author?.jobTitle ?? '');
  const [bio, setBio] = useState(author?.bio ?? '');
  const [linkToMe, setLinkToMe] = useState(author ? author.userId === user.id : false);
  const { run, busy, errors } = useMutation();

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const body = {
      name,
      slug,
      jobTitle,
      bio,
      avatarMediaId: author?.avatarMediaId ?? null,
      userId: linkToMe ? user.id : author && author.userId !== user.id ? author.userId : null,
    };
    const result = author
      ? await run(`/admin/authors/${author.id}`, 'PUT', body, 'Автор сохранён')
      : await run('/admin/authors', 'POST', body, 'Автор создан');
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
        <DialogHeader title={author ? 'Изменить автора' : 'Новый автор'} />
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <Field label="Имя" htmlFor="author-name" error={errors.name}>
            <Input
              id="author-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" htmlFor="author-slug" error={errors.slug}>
            <Input
              id="author-slug"
              value={slug}
              className="font-mono text-[13px]"
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugTouched(true);
              }}
            />
          </Field>
          <Field label="Должность" htmlFor="author-job" error={errors.jobTitle}>
            <Input
              id="author-job"
              value={jobTitle}
              onChange={(e) => {
                setJobTitle(e.target.value);
              }}
              placeholder="Ведущий системный администратор"
            />
          </Field>
          <Field label="О себе" htmlFor="author-bio" error={errors.bio}>
            <Textarea
              id="author-bio"
              rows={4}
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
              }}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={linkToMe}
              onChange={(e) => {
                setLinkToMe(e.target.checked);
              }}
              className="size-4 accent-[var(--primary)]"
            />
            Это мой профиль (подставляется автором в мои новые статьи)
          </label>
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
