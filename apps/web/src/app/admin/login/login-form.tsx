'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@skytech/contracts';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { api } from '@/lib/api/client';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/admin/auth/login', { method: 'POST', body: values });
      // Only internal admin paths are accepted as a return target (no open redirect).
      const next = params.get('next');
      router.replace(next?.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Field
        label="Email"
        htmlFor="email"
        error={errors.email ? 'Введите корректный email' : undefined}
      >
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
      </Field>
      <Field
        label="Пароль"
        htmlFor="password"
        error={errors.password ? 'Введите пароль' : undefined}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? <Spinner /> : null} Войти
      </Button>
    </form>
  );
}
