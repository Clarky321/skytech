import type { CategoryTreeNode } from '@skytech/contracts';
import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme';
import { Logo } from './logo';

export function SiteHeader({ categories }: { categories: CategoryTreeNode[] }) {
  const primary = categories.slice(0, 6);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-15 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Разделы" className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          <Link
            href="/articles"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Все статьи
          </Link>
          {primary.map((c) => (
            <Link
              key={c.id}
              href={c.path}
              className="truncate rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {/* Mobile navigation without client JS: a native disclosure. */}
          <details className="group relative lg:hidden">
            <summary
              className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden"
              aria-label="Меню"
            >
              <MenuIcon className="size-4" />
            </summary>
            <nav
              aria-label="Разделы"
              className="absolute right-0 mt-2 w-64 rounded-lg border bg-popover p-2 shadow-lg"
            >
              <Link
                href="/articles"
                className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Все статьи
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={c.path}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
