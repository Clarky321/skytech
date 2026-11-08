import {
  CODE_LANGUAGES,
  slugify,
  type CalloutVariant,
  type DocBlock,
  type DocInline,
  type DocMark,
  type DocTableRow,
  type MediaRef,
  type RenderedBody,
  type SkyDocument,
  type TocItem,
} from '@skytech/contracts';
import type { Element, ElementContent, Root } from 'hast';
import { sanitize } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';
import { createSkyLowlight, normalizeLanguage, type SkyLowlight } from './highlight.js';
import { articleSanitizeSchema } from './sanitize-schema.js';

export type MediaResolver = (mediaId: string) => MediaRef | undefined;

export interface RenderDocumentOptions {
  /** Looks up media referenced by image nodes. Unknown ids are skipped and reported. */
  resolveMedia: MediaResolver;
  /** Origin of the site (e.g. https://skytech.ru); links elsewhere get rel="noopener noreferrer". */
  siteOrigin?: string;
}

export interface RenderResult extends RenderedBody {
  /** Text content for full-text search (Phase 7) and excerpts. */
  plainText: string;
  /** Image nodes whose media could not be resolved (rendered as nothing). */
  missingMediaIds: string[];
}

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  info: 'Информация',
  warning: 'Внимание',
  danger: 'Опасно',
  success: 'Рекомендация',
};

const WORDS_PER_MINUTE = 180;
const IMAGE_SIZES = '(min-width: 900px) 760px, 100vw';

let lowlightInstance: SkyLowlight | undefined;
function lowlight(): SkyLowlight {
  lowlightInstance ??= createSkyLowlight();
  return lowlightInstance;
}

interface RenderContext {
  options: RenderDocumentOptions;
  headingIds: Set<string>;
  toc: TocItem[];
  text: string[];
  missingMediaIds: Set<string>;
}

/**
 * Renders a validated SkyTech document to sanitized HTML.
 * Pipeline: JSON → HAST (only known constructs) → hast-util-sanitize (allow-list) → HTML.
 */
export function renderDocument(doc: SkyDocument, options: RenderDocumentOptions): RenderResult {
  const ctx: RenderContext = {
    options,
    headingIds: new Set(),
    toc: [],
    text: [],
    missingMediaIds: new Set(),
  };
  const tree: Root = { type: 'root', children: renderBlocks(doc.content, ctx) };
  const clean = sanitize(tree, articleSanitizeSchema);
  const html = toHtml(clean);

  const plainText = ctx.text
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  return {
    html,
    toc: ctx.toc,
    plainText,
    wordCount,
    readingTimeMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
    missingMediaIds: [...ctx.missingMediaIds],
  };
}

function renderBlocks(blocks: readonly DocBlock[], ctx: RenderContext): ElementContent[] {
  const out: ElementContent[] = [];
  for (const block of blocks) {
    const el = renderBlock(block, ctx);
    if (el) out.push(el);
  }
  return out;
}

function renderBlock(block: DocBlock, ctx: RenderContext): Element | null {
  switch (block.type) {
    case 'paragraph': {
      const children = renderInline(block.content, ctx);
      ctx.text.push('');
      // Empty paragraphs are editor spacing, not content.
      return children.length > 0 ? h('p', children) : null;
    }
    case 'heading': {
      const text = inlineText(block.content).trim();
      if (!text) return null;
      const id = uniqueHeadingId(text, ctx);
      ctx.toc.push({ id, text, level: block.attrs.level });
      const children = renderInline(block.content, ctx);
      ctx.text.push('');
      // Body H1–H4 become h2–h5: the page h1 is the article title.
      const tag = `h${String(block.attrs.level + 1)}`;
      return h(tag, { id }, [
        ...children,
        h('a', { href: `#${id}`, className: ['heading-anchor'] }, '#'),
      ]);
    }
    case 'codeBlock':
      return renderCodeBlock(block.attrs.language, block.content?.[0]?.text ?? '', ctx);
    case 'horizontalRule':
      return h('hr');
    case 'image':
      return renderImage(block.attrs, ctx);
    case 'blockquote':
      return h('blockquote', renderBlocks(block.content, ctx));
    case 'callout':
      return h(
        'aside',
        {
          className: ['callout', `callout--${block.attrs.variant}`],
          role: 'note',
          dataVariant: block.attrs.variant,
        },
        [
          h('div', { className: ['callout__title'] }, CALLOUT_LABELS[block.attrs.variant]),
          h('div', { className: ['callout__body'] }, renderBlocks(block.content, ctx)),
        ],
      );
    case 'bulletList':
      return h(
        'ul',
        block.content.map((item) => h('li', renderBlocks(item.content, ctx))),
      );
    case 'orderedList':
      return h(
        'ol',
        block.attrs.start !== 1 ? { start: block.attrs.start } : {},
        block.content.map((item) => h('li', renderBlocks(item.content, ctx))),
      );
    case 'taskList':
      return h(
        'ul',
        { className: ['task-list'] },
        block.content.map((item) =>
          h('li', { className: ['task-list__item'], dataChecked: String(item.attrs.checked) }, [
            h('input', { type: 'checkbox', disabled: true, checked: item.attrs.checked }),
            h('div', { className: ['task-list__content'] }, renderBlocks(item.content, ctx)),
          ]),
        ),
      );
    case 'table':
      return renderTable(block.content, ctx);
  }
}

function renderCodeBlock(language: string | null, code: string, ctx: RenderContext): Element {
  const lang = normalizeLanguage(language);
  const label = CODE_LANGUAGES.find((l) => l.id === lang)?.label ?? 'Текст';
  ctx.text.push(code);
  const highlighted =
    lang === 'plaintext'
      ? [{ type: 'text' as const, value: code }]
      : (lowlight().highlight(lang, code).children as ElementContent[]);
  return h('figure', { className: ['code-block'], dataLanguage: lang }, [
    h('div', { className: ['code-block__header'] }, [
      h('span', { className: ['code-block__lang'] }, label),
      h(
        'button',
        {
          type: 'button',
          className: ['code-block__copy'],
          dataCopyCode: true,
          ariaLabel: 'Скопировать код',
        },
        'Копировать',
      ),
    ]),
    h('pre', [h('code', { className: ['hljs', `language-${lang}`] }, highlighted)]),
  ]);
}

function renderImage(
  attrs: { mediaId: string; alt: string; caption: string },
  ctx: RenderContext,
): Element | null {
  const media = ctx.options.resolveMedia(attrs.mediaId);
  if (!media) {
    ctx.missingMediaIds.add(attrs.mediaId);
    return null;
  }
  const alt = attrs.alt || media.alt;
  if (attrs.caption) ctx.text.push(attrs.caption);
  const srcSet = media.sources.map((s) => `${s.url} ${String(s.width)}w`).join(', ');
  const img = h('img', {
    src: media.url,
    srcSet: srcSet || undefined,
    sizes: srcSet ? IMAGE_SIZES : undefined,
    width: media.width,
    height: media.height,
    alt,
    loading: 'lazy',
    decoding: 'async',
  });
  return h(
    'figure',
    { className: ['doc-image'] },
    attrs.caption ? [img, h('figcaption', attrs.caption)] : [img],
  );
}

function renderTable(rows: readonly DocTableRow[], ctx: RenderContext): Element {
  const isHeaderRow = (row: DocTableRow) => row.content.every((c) => c.type === 'tableHeader');
  const [first, ...rest] = rows;
  const headerRow = first && isHeaderRow(first) ? first : null;
  const bodyRows = headerRow ? rest : rows;

  const renderRow = (row: DocTableRow, inHead: boolean) =>
    h(
      'tr',
      row.content.map((cell) => {
        const tag = cell.type === 'tableHeader' ? 'th' : 'td';
        return h(
          tag,
          {
            colSpan: cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined,
            rowSpan: cell.attrs.rowspan > 1 ? cell.attrs.rowspan : undefined,
            scope: inHead ? 'col' : undefined,
          },
          renderBlocks(cell.content, ctx),
        );
      }),
    );

  const sections: Element[] = [];
  if (headerRow) sections.push(h('thead', [renderRow(headerRow, true)]));
  sections.push(
    h(
      'tbody',
      bodyRows.map((row) => renderRow(row, false)),
    ),
  );
  return h('div', { className: ['table-wrap'] }, [h('table', sections)]);
}

function renderInline(
  nodes: readonly DocInline[] | undefined,
  ctx: RenderContext,
): ElementContent[] {
  if (!nodes) return [];
  const out: ElementContent[] = [];
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out.push(h('br'));
      ctx.text.push('\n');
      continue;
    }
    ctx.text.push(node.text);
    out.push(applyMarks(node.text, node.marks ?? [], ctx));
  }
  return out;
}

const MARK_TAGS = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
} as const;

function applyMarks(text: string, marks: readonly DocMark[], ctx: RenderContext): ElementContent {
  let el: ElementContent = { type: 'text', value: text };
  let link: Extract<DocMark, { type: 'link' }> | undefined;
  for (const mark of marks) {
    if (mark.type === 'link') {
      link = mark;
      continue;
    }
    el = h(MARK_TAGS[mark.type], [el]);
  }
  // Link is always the outermost wrapper.
  if (link) {
    const external = isExternal(link.attrs.href, ctx.options.siteOrigin);
    el = h('a', { href: link.attrs.href, rel: external ? 'noopener noreferrer' : undefined }, [el]);
  }
  return el;
}

function isExternal(href: string, siteOrigin: string | undefined): boolean {
  if (!/^https?:/i.test(href)) return false;
  if (!siteOrigin) return true;
  try {
    return new URL(href).origin !== new URL(siteOrigin).origin;
  } catch {
    return true;
  }
}

function inlineText(nodes: readonly DocInline[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'text' ? n.text : ' ')).join('');
}

function uniqueHeadingId(text: string, ctx: RenderContext): string {
  const base = slugify(text) || 'section';
  let id = base;
  for (let i = 2; ctx.headingIds.has(id); i++) id = `${base}-${String(i)}`;
  ctx.headingIds.add(id);
  return id;
}
