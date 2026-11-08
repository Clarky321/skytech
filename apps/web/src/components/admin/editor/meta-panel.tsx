'use client';

import {
  type Author,
  type CategoryTreeNode,
  type ContentDraft,
  type ContentType,
  type Media,
  slugify,
  type Tag,
} from '@skytech/contracts';
import { ImagePlusIcon, RefreshCwIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAdmin } from '../admin-context';
import { MediaPicker } from '../media-picker';
import { TagSelect } from './tag-select';

export type MetaDraft = Omit<ContentDraft, 'body'>;

function Counter({ value, max, ideal }: { value: string; max: number; ideal: [number, number] }) {
  const n = value.length;
  const good = n >= ideal[0] && n <= ideal[1];
  return (
    <span
      className={cn(
        'tabular-nums',
        n > max ? 'text-destructive' : good ? 'text-success' : 'text-muted-foreground',
      )}
    >
      {n}/{max}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b p-4 last:border-b-0">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MetaPanel({
  type,
  meta,
  onChange,
  errors,
  categories,
  tags,
  authors,
  slugLocked,
  onTagCreated,
}: {
  type: ContentType;
  meta: MetaDraft;
  onChange: (patch: Partial<MetaDraft>, options?: { manualSlug?: boolean }) => void;
  errors: Record<string, string>;
  categories: CategoryTreeNode[];
  tags: Tag[];
  authors: Author[];
  /** Published materials keep their slug unless changed explicitly (a 301 will be created). */
  slugLocked: boolean;
  onTagCreated: (tag: Tag) => void;
}) {
  const { mediaSrc } = useAdmin();
  const [coverPicker, setCoverPicker] = useState(false);
  const [cover, setCover] = useState<Pick<Media, 'id'> | null>(
    meta.coverMediaId ? { id: meta.coverMediaId } : null,
  );

  return (
    <div className="rounded-xl border bg-card">
      <Section title="Публикация">
        <Field
          label="Адрес (slug)"
          htmlFor="slug"
          error={errors.slug}
          hint={
            slugLocked
              ? 'После публикации смена адреса создаст редирект 301 со старого.'
              : 'Создаётся из заголовка; можно изменить.'
          }
        >
          <div className="flex gap-1.5">
            <Input
              id="slug"
              value={meta.slug}
              onChange={(e) => {
                onChange({ slug: e.target.value.toLowerCase() }, { manualSlug: true });
              }}
              aria-invalid={errors.slug ? true : undefined}
              className="font-mono text-[13px]"
              spellCheck={false}
            />
            <Button
              variant="outline"
              size="icon"
              title="Сгенерировать из заголовка"
              aria-label="Сгенерировать адрес из заголовка"
              onClick={() => {
                onChange({ slug: slugify(meta.title) || meta.slug }, { manualSlug: false });
              }}
            >
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>

        {type === 'article' ? (
          <>
            <Field label="Категория" htmlFor="categoryId" error={errors.categoryId}>
              <NativeSelect
                id="categoryId"
                value={meta.categoryId ?? ''}
                onChange={(e) => {
                  onChange({ categoryId: e.target.value || null });
                }}
              >
                <option value="">— Не выбрана —</option>
                {categories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    <option value={c.id}>{c.name}</option>
                    {c.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {c.name} › {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Автор" htmlFor="authorId" error={errors.authorId}>
              <NativeSelect
                id="authorId"
                value={meta.authorId ?? ''}
                onChange={(e) => {
                  onChange({ authorId: e.target.value || null });
                }}
              >
                <option value="">— Не указан —</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Теги" htmlFor="tags" error={errors.tagIds}>
              <TagSelect
                tags={tags}
                value={meta.tagIds}
                onChange={(tagIds) => {
                  onChange({ tagIds });
                }}
                onTagCreated={onTagCreated}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Обложка">
        {cover ? (
          <div className="group relative overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- media from S3 */}
            <img src={mediaSrc(cover)} alt="Обложка" className="aspect-video w-full object-cover" />
            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCoverPicker(true);
                }}
              >
                Заменить
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Убрать обложку"
                onClick={() => {
                  setCover(null);
                  onChange({ coverMediaId: null });
                }}
              >
                <XIcon />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCoverPicker(true);
            }}
            className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <ImagePlusIcon className="size-6" />
            Выбрать обложку
          </button>
        )}
        {errors.coverMediaId ? (
          <p className="text-xs text-destructive">{errors.coverMediaId}</p>
        ) : null}
        <MediaPicker
          open={coverPicker}
          onOpenChange={setCoverPicker}
          title="Обложка материала"
          onSelect={(media) => {
            setCover(media);
            onChange({ coverMediaId: media.id });
          }}
        />
      </Section>

      <Section title="SEO">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[13px] font-medium">
            <label htmlFor="seoTitle">SEO-заголовок</label>
            <Counter value={meta.seoTitle} max={200} ideal={[30, 65]} />
          </div>
          <Input
            id="seoTitle"
            value={meta.seoTitle}
            onChange={(e) => {
              onChange({ seoTitle: e.target.value });
            }}
            placeholder={meta.title || 'По умолчанию — заголовок'}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[13px] font-medium">
            <label htmlFor="seoDescription">SEO-описание</label>
            <Counter value={meta.seoDescription} max={320} ideal={[100, 160]} />
          </div>
          <Textarea
            id="seoDescription"
            rows={3}
            value={meta.seoDescription}
            onChange={(e) => {
              onChange({ seoDescription: e.target.value });
            }}
            placeholder={meta.excerpt || 'По умолчанию — краткое описание'}
          />
        </div>
        <div className="rounded-lg border bg-background p-3" aria-label="Предпросмотр сниппета">
          <p className="truncate text-[15px] text-primary">
            {meta.seoTitle || meta.title || 'Заголовок страницы'}
          </p>
          <p className="truncate text-xs text-success">
            skytech.ru › {type === 'article' ? `articles › ${meta.slug}` : meta.slug}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {meta.seoDescription || meta.excerpt || 'Описание появится в результатах поиска.'}
          </p>
        </div>
      </Section>
    </div>
  );
}
