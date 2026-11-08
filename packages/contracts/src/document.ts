import { z } from 'zod';

/**
 * SkyTech document: a strict subset of ProseMirror/TipTap JSON.
 * The single source of truth for article bodies (ADR 0002). Anything the editor sends
 * that is not described here is rejected (unknown node/mark) or stripped (unknown attrs).
 */
export const DOCUMENT_SCHEMA_VERSION = 1;

export const CALLOUT_VARIANTS = ['info', 'warning', 'danger', 'success'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

/** Languages offered in the code block picker. Keys are highlight.js language names. */
export const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Текст' },
  { id: 'bash', label: 'Bash' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'dos', label: 'CMD' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'sql', label: 'SQL' },
  { id: 'xml', label: 'XML / HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'ini', label: 'INI / TOML' },
  { id: 'nginx', label: 'nginx' },
  { id: 'apache', label: 'Apache' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C#' },
  { id: 'java', label: 'Java' },
  { id: 'php', label: 'PHP' },
  { id: 'diff', label: 'Diff' },
  { id: 'markdown', label: 'Markdown' },
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id'];
export const CODE_LANGUAGE_IDS = CODE_LANGUAGES.map((l) => l.id) as [
  CodeLanguage,
  ...CodeLanguage[],
];

export const HEADING_LEVELS = [1, 2, 3, 4] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

const MAX_TEXT = 20_000;

/** http(s), mailto, site-relative paths and in-page anchors. Rejects javascript:, data:, etc. */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value.length === 0 || value.length > 2048) return false;
  if (value.startsWith('#')) return /^#[\w\-Ѐ-ӿ%.]+$/.test(value);
  if (value.startsWith('/')) return !value.startsWith('//') && !/[\s\\]/.test(value);
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

// ---- document types (explicit, so recursive schemas stay readable and serializable) ----

export type DocMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
  | { type: 'link'; attrs: { href: string } };
export interface DocText {
  type: 'text';
  text: string;
  marks?: DocMark[] | undefined;
}
export interface DocHardBreak {
  type: 'hardBreak';
}
export type DocInline = DocText | DocHardBreak;
export interface DocParagraph {
  type: 'paragraph';
  content?: DocInline[] | undefined;
}
export interface DocHeading {
  type: 'heading';
  attrs: { level: HeadingLevel };
  content?: DocInline[] | undefined;
}
export interface DocCodeBlock {
  type: 'codeBlock';
  attrs: { language: CodeLanguage | null };
  content?: { type: 'text'; text: string }[] | undefined;
}
export interface DocHorizontalRule {
  type: 'horizontalRule';
}
export interface DocImage {
  type: 'image';
  attrs: {
    mediaId: string;
    alt: string;
    caption: string;
    width?: number | null | undefined;
    height?: number | null | undefined;
  };
}
export interface DocBlockquote {
  type: 'blockquote';
  content: DocBlock[];
}
export interface DocCallout {
  type: 'callout';
  attrs: { variant: CalloutVariant };
  content: DocBlock[];
}
export interface DocListItem {
  type: 'listItem';
  content: DocBlock[];
}
export interface DocBulletList {
  type: 'bulletList';
  content: DocListItem[];
}
export interface DocOrderedList {
  type: 'orderedList';
  attrs: { start: number };
  content: DocListItem[];
}
export interface DocTaskItem {
  type: 'taskItem';
  attrs: { checked: boolean };
  content: DocBlock[];
}
export interface DocTaskList {
  type: 'taskList';
  content: DocTaskItem[];
}
export interface DocTableCell {
  type: 'tableCell' | 'tableHeader';
  attrs: { colspan: number; rowspan: number };
  content: DocBlock[];
}
export interface DocTableRow {
  type: 'tableRow';
  content: DocTableCell[];
}
export interface DocTable {
  type: 'table';
  content: DocTableRow[];
}
export type DocBlock =
  | DocParagraph
  | DocHeading
  | DocCodeBlock
  | DocHorizontalRule
  | DocImage
  | DocBlockquote
  | DocCallout
  | DocBulletList
  | DocOrderedList
  | DocTaskList
  | DocTable;
export interface SkyDocument {
  type: 'doc';
  content: DocBlock[];
}

// ---- marks ----

const simpleMark = (type: 'bold' | 'italic' | 'underline' | 'strike' | 'code') =>
  z.object({ type: z.literal(type) });
const linkMarkSchema = z.object({
  type: z.literal('link'),
  attrs: z.object({ href: z.string().refine(isSafeHref, 'Недопустимая ссылка') }),
});
export const markSchema: z.ZodType<DocMark> = z.discriminatedUnion('type', [
  simpleMark('bold'),
  simpleMark('italic'),
  simpleMark('underline'),
  simpleMark('strike'),
  simpleMark('code'),
  linkMarkSchema,
]);

// ---- inline ----

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(MAX_TEXT),
  marks: z.array(markSchema).max(8).optional(),
});
const hardBreakSchema = z.object({ type: z.literal('hardBreak') });
const inlineSchema: z.ZodType<DocInline> = z.discriminatedUnion('type', [
  textNodeSchema,
  hardBreakSchema,
]);
const inlineContent = z.array(inlineSchema).max(2_000).optional();

// ---- blocks (recursive containers use getters — Zod 4 recursion) ----

const paragraphSchema = z.object({ type: z.literal('paragraph'), content: inlineContent });
const headingSchema = z.object({
  type: z.literal('heading'),
  attrs: z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  }),
  content: inlineContent,
});
const codeBlockSchema = z.object({
  type: z.literal('codeBlock'),
  attrs: z
    .object({
      language: z.enum(CODE_LANGUAGE_IDS).nullable().catch('plaintext').default('plaintext'),
    })
    .default({ language: 'plaintext' }),
  content: z
    .array(z.object({ type: z.literal('text'), text: z.string().max(200_000) }))
    .max(1)
    .optional(),
});
const horizontalRuleSchema = z.object({ type: z.literal('horizontalRule') });
const imageSchema = z.object({
  type: z.literal('image'),
  attrs: z.object({
    mediaId: z.uuid(),
    alt: z.string().max(300).default(''),
    caption: z.string().max(500).default(''),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
  }),
});
const blockquoteSchema = z.object({
  type: z.literal('blockquote'),
  get content() {
    return z.array(blockSchema).max(500);
  },
});
const calloutSchema = z.object({
  type: z.literal('callout'),
  attrs: z.object({ variant: z.enum(CALLOUT_VARIANTS).catch('info') }),
  get content() {
    return z.array(blockSchema).max(500);
  },
});
const listItemSchema = z.object({
  type: z.literal('listItem'),
  get content() {
    return z.array(blockSchema).max(200);
  },
});
const bulletListSchema = z.object({
  type: z.literal('bulletList'),
  content: z.array(listItemSchema).max(1_000),
});
const orderedListSchema = z.object({
  type: z.literal('orderedList'),
  attrs: z
    .object({ start: z.number().int().min(0).max(100_000).catch(1).default(1) })
    .default({ start: 1 }),
  content: z.array(listItemSchema).max(1_000),
});
const taskItemSchema = z.object({
  type: z.literal('taskItem'),
  attrs: z.object({ checked: z.boolean().catch(false).default(false) }).default({ checked: false }),
  get content() {
    return z.array(blockSchema).max(200);
  },
});
const taskListSchema = z.object({
  type: z.literal('taskList'),
  content: z.array(taskItemSchema).max(1_000),
});
const cellAttrs = z
  .object({
    colspan: z.number().int().min(1).max(50).catch(1).default(1),
    rowspan: z.number().int().min(1).max(500).catch(1).default(1),
  })
  .default({ colspan: 1, rowspan: 1 });
const tableCellSchema = z.object({
  type: z.enum(['tableCell', 'tableHeader']),
  attrs: cellAttrs,
  get content() {
    return z.array(blockSchema).max(100);
  },
});
const tableRowSchema = z.object({
  type: z.literal('tableRow'),
  content: z.array(tableCellSchema).min(1).max(50),
});
const tableSchema = z.object({
  type: z.literal('table'),
  content: z.array(tableRowSchema).min(1).max(500),
});

export const blockSchema: z.ZodType<DocBlock> = z.discriminatedUnion('type', [
  paragraphSchema,
  headingSchema,
  codeBlockSchema,
  horizontalRuleSchema,
  imageSchema,
  blockquoteSchema,
  calloutSchema,
  bulletListSchema,
  orderedListSchema,
  taskListSchema,
  tableSchema,
]);

export const documentSchema: z.ZodType<SkyDocument> = z.object({
  type: z.literal('doc'),
  content: z.array(blockSchema).max(5_000),
});

export const EMPTY_DOCUMENT: SkyDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Max nesting depth checked before Zod parsing so hostile input cannot exhaust the stack. */
export const MAX_DOCUMENT_DEPTH = 24;

export function documentDepth(value: unknown, depth = 0): number {
  if (depth > MAX_DOCUMENT_DEPTH) return depth;
  if (typeof value !== 'object' || value === null) return depth;
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) return depth;
  let max = depth;
  for (const child of content) {
    max = Math.max(max, documentDepth(child, depth + 1));
    if (max > MAX_DOCUMENT_DEPTH) break;
  }
  return max;
}

/** Document field schema for request bodies: depth guard + structural validation. */
export const documentInputSchema: z.ZodType<SkyDocument> = z
  .unknown()
  .refine((v) => documentDepth(v) <= MAX_DOCUMENT_DEPTH, 'Слишком глубокая вложенность блоков')
  .pipe(documentSchema);

/** Collects mediaIds referenced by image nodes (used for media usage tracking). */
export function collectMediaIds(doc: SkyDocument): string[] {
  const ids = new Set<string>();
  const walk = (nodes: readonly DocBlock[]) => {
    for (const node of nodes) {
      if (node.type === 'image') ids.add(node.attrs.mediaId);
      walk(childBlocks(node));
    }
  };
  walk(doc.content);
  return [...ids];
}

/** Rows/items/cells are not blocks themselves but contain blocks; flatten them for walkers. */
export function childBlocks(node: DocBlock): DocBlock[] {
  switch (node.type) {
    case 'blockquote':
    case 'callout':
      return node.content;
    case 'bulletList':
    case 'orderedList':
      return node.content.flatMap((item) => item.content);
    case 'taskList':
      return node.content.flatMap((item) => item.content);
    case 'table':
      return node.content.flatMap((row) => row.content.flatMap((cell) => cell.content));
    default:
      return [];
  }
}
