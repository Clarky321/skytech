import type {
  CalloutVariant,
  CodeLanguage,
  DocBlock,
  DocInline,
  DocMark,
  DocText,
  SkyDocument,
} from '@skytech/contracts';

// Tiny builders to write seed articles readably. Output is a regular SkyTech document.

type InlineArg = string | DocInline;

const text = (value: string, ...marks: DocMark[]): DocText =>
  marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value };

export const b = (value: string) => text(value, { type: 'bold' });
export const i = (value: string) => text(value, { type: 'italic' });
export const c = (value: string) => text(value, { type: 'code' });
export const a = (value: string, href: string) => text(value, { type: 'link', attrs: { href } });

const inline = (args: InlineArg[]): DocInline[] =>
  args.map((arg) => (typeof arg === 'string' ? text(arg) : arg));

export const p = (...args: InlineArg[]): DocBlock => ({ type: 'paragraph', content: inline(args) });
export const h = (level: 1 | 2 | 3 | 4, value: string): DocBlock => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
export const code = (language: CodeLanguage, value: string): DocBlock => ({
  type: 'codeBlock',
  attrs: { language },
  content: [text(value.trim())],
});
export const callout = (variant: CalloutVariant, ...blocks: DocBlock[]): DocBlock => ({
  type: 'callout',
  attrs: { variant },
  content: blocks,
});
export const quote = (...blocks: DocBlock[]): DocBlock => ({ type: 'blockquote', content: blocks });
export const hr = (): DocBlock => ({ type: 'horizontalRule' });

const item = (value: InlineArg | InlineArg[]) => ({
  type: 'listItem' as const,
  content: [p(...(Array.isArray(value) ? value : [value]))],
});
export const ul = (...items: (InlineArg | InlineArg[])[]): DocBlock => ({
  type: 'bulletList',
  content: items.map(item),
});
export const ol = (...items: (InlineArg | InlineArg[])[]): DocBlock => ({
  type: 'orderedList',
  attrs: { start: 1 },
  content: items.map(item),
});
export const tasks = (...items: [boolean, string][]): DocBlock => ({
  type: 'taskList',
  content: items.map(([checked, value]) => ({
    type: 'taskItem',
    attrs: { checked },
    content: [p(value)],
  })),
});
export const table = (header: string[], rows: (InlineArg | InlineArg[])[][]): DocBlock => ({
  type: 'table',
  content: [
    {
      type: 'tableRow',
      content: header.map((cell) => ({
        type: 'tableHeader',
        attrs: { colspan: 1, rowspan: 1 },
        content: [p(cell)],
      })),
    },
    ...rows.map((row) => ({
      type: 'tableRow' as const,
      content: row.map((cell) => ({
        type: 'tableCell' as const,
        attrs: { colspan: 1, rowspan: 1 },
        content: [p(...(Array.isArray(cell) ? cell : [cell]))],
      })),
    })),
  ],
});

export const doc = (...blocks: DocBlock[]): SkyDocument => ({ type: 'doc', content: blocks });
