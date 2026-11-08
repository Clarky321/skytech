import { type CurrentUser, ROLE_LABELS } from '@skytech/contracts';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { adminApi } from '@/lib/api/server';
import { PasswordForm, ProfileForm } from './profile-forms';

export const metadata: Metadata = { title: 'Профиль' };

export default async function ProfilePage() {
  const user = await adminApi<CurrentUser>('/admin/auth/me');
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPageHeader title="Профиль" description={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <div className="grid gap-6">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Отображаемое имя</h2>
          <ProfileForm displayName={user.displayName} />
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-1 font-semibold">Смена пароля</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            После смены пароля все другие сеансы будут завершены.
          </p>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
