import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LogoMark } from '@/components/site/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Вход в редакцию',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-10" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Редакция SkyTech</h1>
          <p className="mt-1 text-sm text-muted-foreground">Вход для сотрудников</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Учётные записи создаёт администратор. Публичной регистрации нет.
        </p>
      </div>
    </div>
  );
}
