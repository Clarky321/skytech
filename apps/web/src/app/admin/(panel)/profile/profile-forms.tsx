'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
} from '@skytech/contracts';
import { type SubmitEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@/components/admin/crud';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { ApiError, api } from '@/lib/api/client';

export function ProfileForm({ displayName }: { displayName: string }) {
  const [value, setValue] = useState(displayName);
  const { run, busy, errors } = useMutation();
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    void run('/admin/auth/me', 'PATCH', { displayName: value }, 'Имя сохранено');
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field
        label="Имя"
        htmlFor="displayName"
        error={errors.displayName}
        className="min-w-60 flex-1"
      >
        <Input
          id="displayName"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          maxLength={120}
        />
      </Field>
      <Button type="submit" disabled={busy || value.trim() === displayName}>
        {busy ? <Spinner /> : null} Сохранить
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api('/admin/auth/me/password', { method: 'POST', body: values });
      toast.success('Пароль изменён');
      reset();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors().currentPassword) {
        setError('currentPassword', { message: error.fieldErrors().currentPassword });
      } else {
        toast.error(error instanceof Error ? error.message : 'Не удалось сменить пароль');
      }
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4" noValidate>
      <Field
        label="Текущий пароль"
        htmlFor="currentPassword"
        error={errors.currentPassword?.message}
      >
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...register('currentPassword')}
        />
      </Field>
      <Field
        label="Новый пароль"
        htmlFor="newPassword"
        error={errors.newPassword?.message}
        hint={`Не короче ${String(PASSWORD_MIN_LENGTH)} символов. Лучше фраза из нескольких слов.`}
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null} Сменить пароль
        </Button>
      </div>
    </form>
  );
}
