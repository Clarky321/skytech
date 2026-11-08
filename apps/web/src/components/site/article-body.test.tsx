import { renderDocument } from '@skytech/content-render';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArticleBody } from './article-body';

afterEach(cleanup);

// Real renderer output, exactly what the API stores in a revision.
const { html } = renderDocument(
  {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Проверка' }] },
      {
        type: 'codeBlock',
        attrs: { language: 'bash' },
        content: [{ type: 'text', text: 'systemctl status nginx' }],
      },
    ],
  },
  { resolveMedia: () => undefined },
);

describe('ArticleBody', () => {
  it('renders the sanitized article HTML', () => {
    const { container } = render(<ArticleBody html={html} />);
    expect(screen.getByRole('heading', { level: 3, name: /Проверка/ })).toBeDefined();
    // Highlighting splits code into spans; the text itself must be intact.
    expect(container.querySelector('pre code')?.textContent).toBe('systemctl status nginx');
  });

  it('copies the code of the clicked block', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ArticleBody html={html} />);

    const button = screen.getByRole('button', { name: 'Скопировать код' });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('systemctl status nginx');
    expect(button.textContent).toBe('Скопировано');
  });
});
