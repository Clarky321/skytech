'use client';

import { slugify, type Tag } from '@skytech/contracts';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useAdmin } from '../admin-context';

export function TagSelect({
  tags,
  value,
  onChange,
  onTagCreated,
}: {
  tags: Tag[];
  value: string[];
  onChange: (ids: string[]) => void;
  onTagCreated: (tag: Tag) => void;
}) {
  const { can } = useAdmin();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const q = query.trim().toLowerCase();
  const filtered = tags.filter((t) => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q));
  const exact = tags.some((t) => t.name.toLowerCase() === q);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const create = async () => {
    const name = query.trim();
    const slug = slugify(name);
    if (!name || !slug) return;
    setCreating(true);
    try {
      const tag = await api<Tag>('/admin/tags', { method: 'POST', body: { name, slug } });
      onTagCreated(tag);
      onChange([...value, tag.id]);
      setQuery('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать тег');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted py-0.5 pr-1 pl-2.5 text-xs"
            >
              {byId.get(id)?.name ?? '—'}
              <button
                type="button"
                onClick={() => {
                  toggle(id);
                }}
                aria-label={`Убрать тег ${byId.get(id)?.name ?? ''}`}
                className="rounded-full p-0.5 hover:bg-background"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-muted-foreground"
            id="tags"
          >
            <PlusIcon /> Добавить теги
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Найти или создать тег"
            aria-label="Поиск тегов"
            className="mb-2 h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = filtered[0];
                if (first && (exact || !can('taxonomy.manage'))) toggle(first.id);
                else if (q && can('taxonomy.manage')) void create();
              }
            }}
          />
          <div className="max-h-56 overflow-y-auto" role="listbox" aria-multiselectable>
            {filtered.map((t) => {
              const selected = value.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    toggle(t.id);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                    selected && 'font-medium',
                  )}
                >
                  {t.name}
                  {selected ? <CheckIcon className="size-4 text-primary" /> : null}
                </button>
              );
            })}
            {q && !exact && can('taxonomy.manage') ? (
              <button
                type="button"
                disabled={creating || !slugify(query)}
                onClick={() => void create()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              >
                <PlusIcon className="size-4" /> Создать тег «{query.trim()}»
              </button>
            ) : null}
            {filtered.length === 0 && !(q && can('taxonomy.manage')) ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Ничего не найдено</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
