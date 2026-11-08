'use client';

import {
  type Media,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_BYTES,
  type Paginated,
} from '@skytech/contracts';
import { CheckIcon, ImageIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { ApiError, api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useAdmin } from './admin-context';

/** Uploads one image through the API (server validates the signature and re-encodes it). */
export async function uploadImage(file: File): Promise<Media> {
  if (file.size > MEDIA_MAX_BYTES) throw new Error(`«${file.name}» больше 10 МБ`);
  const form = new FormData();
  form.append('file', file);
  return api<Media>('/admin/media', { method: 'POST', form });
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Не удалось загрузить файл';
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  title = 'Изображение',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: Media) => void;
  title?: string;
}) {
  const { mediaSrc } = useAdmin();
  const [items, setItems] = useState<Media[] | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    const params = new URLSearchParams({ pageSize: '48' });
    if (q) params.set('q', q);
    try {
      const data = await api<Paginated<Media>>(`/admin/media?${params.toString()}`);
      setItems(data.items);
    } catch (error) {
      toast.error(uploadErrorMessage(error));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(query), query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, query, load]);

  const changeOpen = (next: boolean) => {
    if (!next) setSelected(null);
    onOpenChange(next);
  };

  const choose = (media: Media) => {
    onSelect(media);
    changeOpen(false);
  };

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      choose(await uploadImage(file));
      toast.success('Изображение загружено');
    } catch (error) {
      toast.error(uploadErrorMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent wide>
        <DialogHeader
          title={title}
          description="Загрузите файл с компьютера или выберите из медиатеки. JPEG, PNG, WebP, GIF до 10 МБ."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner /> : <UploadIcon />} Загрузить с компьютера
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_ALLOWED_MIME.join(',')}
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
            data-testid="media-upload-input"
          />
          <div className="relative ml-auto w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Поиск по имени или alt"
              className="pl-8"
              aria-label="Поиск в медиатеке"
            />
          </div>
        </div>
        <div className="min-h-64">
          {items === null ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ImageIcon />}
              title="Медиатека пуста"
              description="Загрузите первое изображение кнопкой выше."
            />
          ) : (
            <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-4">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelected(m);
                  }}
                  onDoubleClick={() => {
                    choose(m);
                  }}
                  aria-pressed={selected?.id === m.id}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring',
                    selected?.id === m.id && 'ring-2 ring-primary',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- media from S3 */}
                  <img
                    src={mediaSrc(m)}
                    alt={m.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block truncate px-2 py-1 text-xs text-muted-foreground">
                    {m.originalName}
                  </span>
                  {selected?.id === m.id ? (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              changeOpen(false);
            }}
          >
            Отмена
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) choose(selected);
            }}
          >
            Вставить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
