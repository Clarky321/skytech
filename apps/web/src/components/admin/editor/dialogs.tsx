'use client';

import type { RevisionSummary } from '@skytech/contracts';
import { HistoryIcon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

/** `datetime-local` works in local time; the API receives an ISO string with offset. */
function defaultLocalValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (iso: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(defaultLocalValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now() + 60_000) {
      setError('Укажите время хотя бы на минуту позже текущего');
      return;
    }
    setBusy(true);
    const ok = await onConfirm(date.toISOString());
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title="Запланировать публикацию"
          description="Материал опубликуется автоматически в указанное время (нужен запущенный worker). До этого его можно редактировать."
        />
        <Field
          label="Дата и время (ваше локальное время)"
          htmlFor="scheduledAt"
          error={error ?? undefined}
        >
          <Input
            id="scheduledAt"
            type="datetime-local"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Отмена
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner /> : null} Запланировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevisionsDialog({
  contentId,
  open,
  onOpenChange,
  onRestore,
  canRestore,
}: {
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (revisionId: string) => Promise<boolean>;
  canRestore: boolean;
}) {
  const [items, setItems] = useState<RevisionSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api<RevisionSummary[]>(`/admin/content/${contentId}/revisions`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Не удалось загрузить историю');
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, contentId]);

  // Reset on close so the next opening shows a loader, not a stale list.
  const changeOpen = (next: boolean) => {
    if (!next) setItems(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title="История версий"
          description="Каждое сохранение — отдельная неизменяемая версия. Восстановление создаёт новую версию черновика; опубликованная версия не меняется до публикации."
        />
        {items === null ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<HistoryIcon />} title="История пуста" />
        ) : (
          <ol className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title || 'Без названия'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)} · {r.createdBy?.name ?? 'система'}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
                {r.isPublished ? <Badge variant="success">опубликована</Badge> : null}
                {r.isDraft ? <Badge variant="neutral">текущая</Badge> : null}
                {!r.isDraft && canRestore ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(r.id);
                      void onRestore(r.id).then((ok) => {
                        setBusy(null);
                        if (ok) changeOpen(false);
                      });
                    }}
                  >
                    {busy === r.id ? <Spinner /> : <RotateCcwIcon />} Восстановить
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
