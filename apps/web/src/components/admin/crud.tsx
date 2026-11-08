'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { ApiError, api } from '@/lib/api/client';

/** Shared mutation helper for simple admin forms: calls the API, maps 422/409 field errors. */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async <T,>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: unknown,
    success: string,
  ): Promise<T | null> => {
    setBusy(true);
    setErrors({});
    try {
      const result = await api<T>(path, { method, body });
      toast.success(success);
      router.refresh();
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors());
        toast.error(error.message);
      } else {
        toast.error('Не удалось выполнить действие');
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, errors, setErrors };
}

export function ConfirmDelete({
  title,
  description,
  path,
  open,
  onOpenChange,
  success,
}: {
  title: string;
  description: string;
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  success: string;
}) {
  const { run, busy } = useMutation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={description} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              void run(path, 'DELETE', undefined, success).then((r) => {
                if (r !== null) onOpenChange(false);
              })
            }
          >
            {busy ? <Spinner /> : null} Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
