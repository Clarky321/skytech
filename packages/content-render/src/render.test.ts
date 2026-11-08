import { documentSchema, type MediaRef, type SkyDocument } from '@skytech/contracts';
import { describe, expect, it } from 'vitest';
import { renderDocument } from './render.js';

const MEDIA_ID = '0b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e11';
const media: MediaRef = {
  id: MEDIA_ID,
  alt: 'Свойства адаптера',
  width: 1600,
  height: 900,
  url: 'https://cdn.example/media/x/full.webp',
  sources: [
    { url: 'https://cdn.example/media/x/640.webp', width: 640 },
    { url: 'https://cdn.example/media/x/1280.webp', width: 1280 },
  ],
};
const resolveMedia = (id: string) => (id === MEDIA_ID ? media : undefined);

/** Renders a document exactly as the API does: schema-validated first. */
const render = (doc: unknown) =>
  renderDocument(documentSchema.parse(doc), { resolveMedia, siteOrigin: 'https://skytech.ru' });

/** Renders a document that bypasses the schema (defence-in-depth checks). */
const renderUnchecked = (doc: unknown) =>
  renderDocument(doc as SkyDocument, { resolveMedia, siteOrigin: 'https://skytech.ru' });

const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({
  type: 'text',
  text,
  ...(marks ? { marks } : {}),
});
const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});

describe('renderDocument — structure', () => {
  it('renders headings one level lower with stable ids and a TOC', () => {
    const result = render({
      type: 'doc',
      content: [heading(1, 'Настройка DNS'), heading(2, 'Проверка'), heading(2, 'Проверка')],
    });
    expect(result.html).toContain('<h2 id="nastroyka-dns">Настройка DNS');
    expect(result.html).toContain('<h3 id="proverka">');
    expect(result.html).toContain('<h3 id="proverka-2">');
    expect(result.html).not.toContain('<h1');
    expect(result.toc).toEqual([
      { id: 'nastroyka-dns', text: 'Настройка DNS', level: 1 },
      { id: 'proverka', text: 'Проверка', level: 2 },
      { id: 'proverka-2', text: 'Проверка', level: 2 },
    ]);
  });

  it('applies marks with the link outermost and marks external links', () => {
    const { html } = render({
      type: 'doc',
      content: [
        p(
          t('ipconfig', [{ type: 'code' }]),
          t(' и '),
          t('docs', [
            { type: 'bold' },
            { type: 'link', attrs: { href: 'https://learn.microsoft.com' } },
          ]),
          t(' '),
          t('внутренняя', [{ type: 'link', attrs: { href: '/articles/dns' } }]),
        ),
      ],
    });
    expect(html).toContain('<code>ipconfig</code>');
    expect(html).toContain(
      '<a href="https://learn.microsoft.com" rel="noopener noreferrer"><strong>docs</strong></a>',
    );
    expect(html).toContain('<a href="/articles/dns">внутренняя</a>');
  });

  it('renders callouts with a variant class and label', () => {
    const { html } = render({
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { variant: 'warning' },
          content: [p(t('Сохраните текущие настройки IP и DNS'))],
        },
      ],
    });
    expect(html).toContain('class="callout callout--warning"');
    expect(html).toContain('role="note"');
    expect(html).toContain('<div class="callout__title">Внимание</div>');
    expect(html).toContain('Сохраните текущие настройки IP и DNS');
  });

  it('highlights code and keeps a copy button', () => {
    const { html, plainText } = render({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'powershell' },
          content: [t('Get-NetIPAddress -AddressFamily IPv4')],
        },
      ],
    });
    expect(html).toContain('data-language="powershell"');
    expect(html).toContain('class="hljs language-powershell"');
    expect(html).toContain('<span class="hljs-');
    expect(html).toContain('data-copy-code');
    expect(html).toContain('<span class="code-block__lang">PowerShell</span>');
    expect(plainText).toContain('Get-NetIPAddress');
  });

  it('renders tables with a header row in thead', () => {
    const cell = (type: string, text: string) => ({ type, content: [p(t(text))] });
    const { html } = render({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [cell('tableHeader', 'Порт'), cell('tableHeader', 'Служба')],
            },
            { type: 'tableRow', content: [cell('tableCell', '53'), cell('tableCell', 'DNS')] },
          ],
        },
      ],
    });
    expect(html).toMatch(/<div class="table-wrap"><table><thead><tr><th scope="col">/);
    expect(html).toContain('<td><p>53</p></td>');
  });

  it('renders images from resolved media with srcset, dimensions and caption', () => {
    const result = render({
      type: 'doc',
      content: [
        { type: 'image', attrs: { mediaId: MEDIA_ID, alt: '', caption: 'Рис. 1. Свойства' } },
        { type: 'image', attrs: { mediaId: '9b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e19' } },
      ],
    });
    expect(result.html).toContain('src="https://cdn.example/media/x/full.webp"');
    expect(result.html).toContain('640w');
    expect(result.html).toContain('width="1600" height="900"');
    expect(result.html).toContain('alt="Свойства адаптера"');
    expect(result.html).toContain('<figcaption>Рис. 1. Свойства</figcaption>');
    expect(result.missingMediaIds).toEqual(['9b9c3c5e-7d8f-4a43-9b0e-5f2d2a7c1e19']);
  });

  it('renders task lists as disabled checkboxes', () => {
    const { html } = render({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [p(t('Бэкап сделан'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [p(t('Перезагрузка'))] },
          ],
        },
      ],
    });
    expect(html).toContain('<input type="checkbox" disabled checked>');
    expect(html).toContain('data-checked="false"');
  });

  it('skips empty paragraphs and computes reading time', () => {
    const words = Array.from({ length: 540 }, () => 'слово').join(' ');
    const result = render({ type: 'doc', content: [{ type: 'paragraph' }, p(t(words))] });
    expect(result.html.startsWith('<p>слово')).toBe(true);
    expect(result.wordCount).toBe(540);
    expect(result.readingTimeMinutes).toBe(3);
  });
});

describe('renderDocument — XSS', () => {
  it('escapes HTML in text, headings, captions and alt', () => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const { html } = render({
      type: 'doc',
      content: [
        heading(2, payload),
        p(t(payload)),
        {
          type: 'image',
          attrs: { mediaId: MEDIA_ID, alt: '" onerror="alert(1)', caption: payload },
        },
        { type: 'codeBlock', attrs: { language: 'bash' }, content: [t(payload)] },
      ],
    });
    expect(html).not.toContain('<script');
    // The injected <img> stays text; the quote in alt is encoded, so no attribute breaks out.
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('alt="&#x22; onerror=&#x22;alert(1)"');
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('&#x3C;script>');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ])('drops dangerous href %s even if the schema was bypassed', (href) => {
    const { html } = renderUnchecked({
      type: 'doc',
      content: [p(t('click', [{ type: 'link', attrs: { href } }]))],
    });
    expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
    expect(html).toContain('click');
  });

  it('ignores unknown attributes and event handlers on known nodes', () => {
    const { html } = renderUnchecked({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { onclick: 'alert(1)', style: 'x', class: 'evil' },
          content: [t('ok')],
        },
        {
          type: 'callout',
          attrs: { variant: 'info', onmouseover: 'alert(1)' },
          content: [p(t('x'))],
        },
      ],
    });
    expect(html).not.toMatch(/on(click|mouseover)=/i);
    expect(html).not.toContain('style=');
    expect(html).not.toContain('evil');
  });

  it('never emits iframe, svg or script even for unknown node types', () => {
    const { html } = renderUnchecked({
      type: 'doc',
      content: [
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
        { type: 'svg', content: [{ type: 'script' }] },
        p(t('safe')),
      ],
    });
    expect(html).toBe('<p>safe</p>');
  });

  it('neutralises a hostile code language', () => {
    const { html } = renderUnchecked({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: '"><script>alert(1)</script>' },
          content: [t('x')],
        },
      ],
    });
    expect(html).toContain('data-language="plaintext"');
    expect(html).not.toContain('<script');
  });

  it('does not render images from arbitrary URLs', () => {
    const { html } = renderUnchecked({
      type: 'doc',
      content: [{ type: 'image', attrs: { mediaId: 'https://evil.example/pixel.gif', src: 'x' } }],
    });
    expect(html).toBe('');
  });
});
