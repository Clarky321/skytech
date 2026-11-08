import { ChevronLeftIcon, ChevronRightIcon, HomeIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Breadcrumbs({ items }: { items: { name: string; path?: string }[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="flex items-center hover:text-foreground" aria-label="Главная">
            <HomeIcon className="size-3.5" />
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.name}-${String(i)}`} className="flex items-center gap-1.5">
            <ChevronRightIcon className="size-3.5 opacity-60" aria-hidden />
            {item.path ? (
              <Link href={item.path} className="hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Page-number pagination with real links (crawlable, works without JS). */
export function Pagination({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const window = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);
  const linkClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm transition-colors hover:bg-muted';
  return (
    <nav aria-label="Страницы" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className={linkClass}
          rel="prev"
          aria-label="Предыдущая страница"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : null}
      {window.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - (window[i - 1] ?? p) > 1 ? (
            <span className="px-1 text-muted-foreground">…</span>
          ) : null}
          <Link
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              linkClass,
              p === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link
          href={href(page + 1)}
          className={linkClass}
          rel="next"
          aria-label="Следующая страница"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
