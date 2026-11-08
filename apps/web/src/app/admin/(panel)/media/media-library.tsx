'use client';

import { type Media, MEDIA_ALLOWED_MIME, type Paginated } from '@skytech/contracts';
import { ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useAdmin } from '@/components/admin/admin-context';
import { ConfirmDelete, useMutation } from '@/components/admin/crud';
import { uploadErrorMessage, uploadImage } from '@/components/admin/media-picker';
import { Pagination } from '@/components/site/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { formatDateTime } from '@/lib/utils';

const kb = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${String(Math.round(bytes / 1024))} КБ`;

export function MediaLibrary({ data, page }: { data: Paginated<Media>; page: number }) {
  const { mediaSrc, can } = useAdmin();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Media | null>(null);
  const [deleting, setDeleting] = useState<Media | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadImage(file);
        toast.success(`«${file.name}» загружен`);
      } catch (error) {
        toast.error(uploadErrorMessage(error));
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Всего: {data.total}</p>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner /> : <UploadIcon />} Загрузить изображения
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={MEDIA_ALLOWED_MIME.join(',')}
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>
      {data.items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="Медиатека пуста"
          description="Загрузите изображения здесь или прямо в редакторе статьи."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => {
                  setSelected(m);
                }}
                className="block w-full"
                aria-label={`Открыть ${m.originalName}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- media from S3 */}
                <img
                  src={mediaSrc(m)}
                  alt={m.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-muted object-cover"
                />
              </button>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium" title={m.originalName}>
                  {m.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.width}×{m.height} · {kb(m.size)}
                </p>
                {!m.alt ? <p className="mt-1 text-xs text-warning">нет alt-текста</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        total={data.total}
        pageSize={data.pageSize}
        href={(p) => (p > 1 ? `/admin/media?page=${String(p)}` : '/admin/media')}
      />

      {selected ? (
        <MediaDialog
          media={selected}
          onClose={() => {
            setSelected(null);
          }}
          onDelete={
            can('media.delete')
              ? () => {
                  setDeleting(selected);
                  setSelected(null);
                }
              : undefined
          }
        />
      ) : null}
      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(o) => {
            if (!o) setDeleting(null);
          }}
          title="Удалить изображение?"
          description="Изображение, которое используется в любой версии материала, удалить нельзя — это защищает историю правок."
          path={`/admin/media/${deleting.id}`}
          success="Изображение удалено"
        />
      ) : null}
    </>
  );
}

function MediaDialog({
  media,
  onClose,
  onDelete,
}: {
  media: Media;
  onClose: () => void;
  onDelete?: (() => void) | undefined;
}) {
  const { mediaSrc } = useAdmin();
  const [alt, setAlt] = useState(media.alt);
  const { run, busy, errors } = useMutation();
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent wide>
        <DialogHeader
          title={media.originalName}
          description={`${String(media.width)}×${String(media.height)} · загружено ${formatDateTime(media.createdAt)}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- media from S3 */}
        <img
          src={mediaSrc(media)}
          alt={media.alt}
          className="max-h-[50vh] w-full rounded-lg border bg-muted object-contain"
        />
        <Field
          label="Альтернативный текст"
          htmlFor="media-alt"
          error={errors.alt}
          hint="Используется, если в статье не задан свой alt."
        >
          <Input
            id="media-alt"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
            }}
            maxLength={300}
          />
        </Field>
        <DialogFooter className="sm:justify-between">
          {onDelete ? (
            <Button variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2Icon /> Удалить
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={busy || alt === media.alt}
            onClick={() =>
              void run(`/admin/media/${media.id}`, 'PATCH', { alt }, 'Сохранено').then((r) => {
                if (r) onClose();
              })
            }
          >
            {busy ? <Spinner /> : null} Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
