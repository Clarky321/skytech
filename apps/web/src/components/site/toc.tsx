'use client';

import type { TocItem } from '@skytech/contracts';
import { ListIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const INDENT: Record<number, string> = { 1: 'pl-3', 2: 'pl-6', 3: 'pl-9', 4: 'pl-12' };

/** Table of contents with the current section highlighted while scrolling. */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const minLevel = Math.min(...items.map((i) => i.level));

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    headings.forEach((h) => {
      observer.observe(h);
    });
    return () => {
      observer.disconnect();
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Содержание">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <ListIcon className="size-3.5" aria-hidden /> Содержание
      </p>
      <ul className="space-y-0.5 border-l text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l py-1 pr-2 leading-snug transition-colors',
                INDENT[item.level - minLevel + 1] ?? 'pl-3',
                active === item.id
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
