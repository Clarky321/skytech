'use client';

import { isSafeHref } from '@skytech/contracts';
import type { Editor } from '@tiptap/core';
import { LinkIcon, Unlink2Icon } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { ToolbarButton } from './toolbar-button';

/** Adds/edits a link on the selection. Only safe URLs (same rule as the server). */
export function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = editor.isActive('link');

  const onOpenChange = (next: boolean) => {
    if (next) {
      setHref((editor.getAttributes('link') as { href?: string }).href ?? '');
      setError(null);
    }
    setOpen(next);
  };

  const apply = (e: SubmitEvent) => {
    e.preventDefault();
    const value = href.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setOpen(false);
      return;
    }
    const normalized = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value) ? `https://${value}` : value;
    if (!isSafeHref(normalized)) {
      setError('Допустимы ссылки http(s)://, mailto:, /путь и #якорь');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Ссылка (Ctrl+K)" active={active}>
          <LinkIcon />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <form onSubmit={apply} className="grid gap-2">
          <Input
            autoFocus
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
              setError(null);
            }}
            placeholder="https://learn.microsoft.com/…"
            aria-label="Адрес ссылки"
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-between gap-2">
            {active ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setOpen(false);
                }}
              >
                <Unlink2Icon /> Убрать ссылку
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm">
              Применить
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
