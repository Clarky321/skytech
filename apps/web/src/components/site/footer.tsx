import type { CategoryTreeNode } from '@skytech/contracts';
import Link from 'next/link';
import { Logo } from './logo';

export function SiteFooter({ categories }: { categories: CategoryTreeNode[] }) {
  return (
    <footer className="mt-24 border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Практические инструкции для системных администраторов, сетевых инженеров и DevOps.
            Проверено в реальной инфраструктуре.
          </p>
        </div>
        <nav aria-label="Разделы сайта" className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={c.path}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} SkyTech.ru</span>
          <span>Материалы сайта предназначены для IT-специалистов</span>
        </div>
      </div>
    </footer>
  );
}
