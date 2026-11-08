import type { CategoryTreeNode } from '@skytech/contracts';
import type { ReactNode } from 'react';
import { SiteFooter } from './footer';
import { SiteHeader } from './header';
import { publicApi } from '@/lib/api/server';

export async function SiteShell({ children }: { children: ReactNode }) {
  const categories = (await publicApi<CategoryTreeNode[]>('/v1/categories')) ?? [];
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        К содержимому
      </a>
      <SiteHeader categories={categories} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter categories={categories} />
    </div>
  );
}
