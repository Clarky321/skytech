'use client';

import type { CurrentUser } from '@skytech/contracts';
import { MenuIcon, XIcon } from 'lucide-react';
import { type ReactNode, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminProvider } from './admin-context';
import { AdminSidebar, SidebarBrand, UserMenu } from './sidebar';

export function AdminShell({
  user,
  mediaBaseUrl,
  children,
}: {
  user: CurrentUser;
  mediaBaseUrl: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <AdminProvider user={user} mediaBaseUrl={mediaBaseUrl}>
      <div className="flex min-h-dvh bg-background">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <SidebarBrand />
          <Suspense>
            <AdminSidebar />
          </Suspense>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Закрыть меню"
              onClick={() => {
                setMobileOpen(false);
              }}
            />
            <aside className="relative flex h-full w-64 flex-col border-r bg-sidebar shadow-xl">
              <div className="flex items-center justify-between pr-2">
                <SidebarBrand />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Закрыть меню"
                  onClick={() => {
                    setMobileOpen(false);
                  }}
                >
                  <XIcon />
                </Button>
              </div>
              <Suspense>
                <AdminSidebar
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                />
              </Suspense>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-13 items-center gap-2 border-b px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Меню"
              onClick={() => {
                setMobileOpen(true);
              }}
            >
              <MenuIcon />
            </Button>
            <div className="ml-auto">
              <UserMenu user={user} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
