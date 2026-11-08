import { describe, expect, it } from 'vitest';
import {
  collectMediaIds,
  documentInputSchema,
  documentSchema,
  isSafeHref,
  MAX_DOCUMENT_DEPTH,
} from './document.js';

const MEDIA_ID = '0b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e11';

const richDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Подготовка' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Откройте ' },
        { type: 'text', text: 'PowerShell', marks: [{ type: 'bold' }, { type: 'code' }] },
        { type: 'hardBreak' },
        {
          type: 'text',
          text: 'docs',
          marks: [
            { type: 'link', attrs: { href: 'https://learn.microsoft.com', target: '_blank' } },
          ],
        },
      ],
    },
    {
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Сохраните настройки IP' }] }],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'powershell' },
      content: [{ type: 'text', text: 'Get-NetIPConfiguration' }],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    },
    { type: 'image', attrs: { mediaId: MEDIA_ID, alt: 'Окно', caption: 'Рис. 1' } },
    {
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }] }],
    },
    { type: 'horizontalRule' },
  ],
};

describe('documentSchema', () => {
  it('accepts every supported block and strips unknown attributes', () => {
    const parsed = documentSchema.parse(richDoc);
    const table = parsed.content[4];
    expect(table?.type).toBe('table');
    // colwidth is not part of the schema → stripped
    expect(JSON.stringify(parsed)).not.toContain('colwidth');
    // link target is not stored; rel/target are decided by the renderer
    expect(JSON.stringify(parsed)).not.toContain('_blank');
  });

  it('rejects unknown node types', () => {
    const result = documentSchema.safeParse({
      type: 'doc',
      content: [{ type: 'iframe', attrs: { src: 'https://evil.example' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown marks', () => {
    const result = documentSchema.safeParse({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'script' }] }] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox',
    '//evil.example/path',
    'file:///etc/passwd',
  ])('rejects dangerous link %s', (href) => {
    const result = documentSchema.safeParse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('falls back to plaintext for an unknown code language', () => {
    const parsed = documentSchema.parse({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: '"><script>' },
          content: [{ type: 'text', text: 'x' }],
        },
      ],
    });
    expect(parsed.content[0]).toMatchObject({ attrs: { language: 'plaintext' } });
  });

  it('rejects an image without a valid media id', () => {
    const result = documentSchema.safeParse({
      type: 'doc',
      content: [{ type: 'image', attrs: { mediaId: 'https://evil.example/x.png' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects heading levels outside 1–4', () => {
    const result = documentSchema.safeParse({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'x' }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('documentInputSchema depth guard', () => {
  it('rejects hostile nesting before recursive parsing', () => {
    let node: Record<string, unknown> = { type: 'paragraph' };
    for (let i = 0; i < MAX_DOCUMENT_DEPTH + 5; i++) {
      node = { type: 'blockquote', content: [node] };
    }
    const result = documentInputSchema.safeParse({ type: 'doc', content: [node] });
    expect(result.success).toBe(false);
  });
});

describe('isSafeHref', () => {
  it.each([
    'https://example.com/a?b=1',
    'http://x.ru',
    'mailto:admin@skytech.ru',
    '/articles/x',
    '#nastroyka',
  ])('allows %s', (href) => {
    expect(isSafeHref(href)).toBe(true);
  });
});

describe('collectMediaIds', () => {
  it('finds images inside lists and tables', () => {
    const doc = documentSchema.parse({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'image', attrs: { mediaId: MEDIA_ID } }] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'image',
                      attrs: { mediaId: '1b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e12' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(collectMediaIds(doc).sort()).toEqual(
      [MEDIA_ID, '1b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e12'].sort(),
    );
  });

  it('finds images nested inside containers', () => {
    const doc = documentSchema.parse({
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { variant: 'info' },
          content: [{ type: 'image', attrs: { mediaId: MEDIA_ID } }],
        },
      ],
    });
    expect(collectMediaIds(doc)).toEqual([MEDIA_ID]);
  });
});
