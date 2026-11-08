'use client';

import type { AdminContentDetail, ContentType } from '@skytech/contracts';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { api } from '@/lib/api/client';

export function NewContentForm({ type }: { type: ContentType }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<AdminContentDetail>('/admin/content', {
        method: 'POST',
        body: { type, title },
      });
      router.replace(`/admin/content/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать материал');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 rounded-xl border bg-card p-6">
      <Field
        label="Название"
        htmlFor="new-title"
        error={error ?? undefined}
        hint="Адрес страницы (slug) будет создан автоматически."
      >
        <Input
          id="new-title"
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder={type === 'page' ? 'О проекте' : 'Настройка DNS в Windows Server 2022'}
          maxLength={200}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null} Создать и открыть редактор
        </Button>
      </div>
    </form>
  );
}
