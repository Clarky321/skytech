'use client';

import { type MouseEvent, useCallback } from 'react';

/**
 * Renders article HTML produced and sanitized on the server by @skytech/content-render
 * (allow-list sanitizer, ADR 0002). This component never receives user-supplied HTML.
 * Its only client behaviour is the "copy code" button (event delegation, no extra listeners).
 */
export function ArticleBody({ html }: { html: string }) {
  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]');
    if (!button) return;
    const code = button.closest('.code-block')?.querySelector('pre code')?.textContent ?? '';
    void navigator.clipboard.writeText(code).then(() => {
      button.dataset.copied = 'true';
      button.textContent = 'Скопировано';
      window.setTimeout(() => {
        button.dataset.copied = 'false';
        button.textContent = 'Копировать';
      }, 1800);
    });
  }, []);

  return (
    // Delegated click handling for the real <button>s inside the rendered HTML.
    <div
      className="article-body"
      onClick={onClick}
      // Server-rendered and sanitized by @skytech/content-render.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
