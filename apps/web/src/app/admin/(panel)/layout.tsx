import type { CurrentUser } from '@skytech/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { adminApi, mediaBaseUrl } from '@/lib/api/server';

export const metadata: Metadata = {
  title: { default: 'Редакция', template: '%s — Редакция SkyTech' },
  robots: { index: false, follow: false },
};

/** Every admin page is rendered for a verified session (adminApi redirects to /admin/login on 401). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await adminApi<CurrentUser>('/admin/auth/me');
  return (
    <AdminShell user={user} mediaBaseUrl={mediaBaseUrl()}>
      {children}
    </AdminShell>
  );
}
