import type { CalloutVariant } from '@skytech/contracts';
import type { Editor, Range } from '@tiptap/core';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MinusIcon,
  OctagonXIcon,
  PilcrowIcon,
  QuoteIcon,
  TableIcon,
} from 'lucide-react';

export type BlockGroup = 'Текст' | 'Списки' | 'Примечания' | 'Вставка';

export interface BlockDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: BlockGroup;
  /** Words the slash menu matches (Russian and English, e.g. /heading, /заголовок). */
  keywords: string[];
  /** Can an existing text block be turned into this type? */
  convertible: boolean;
  run: (editor: Editor, range?: Range) => void;
  isActive?: (editor: Editor) => boolean;
}

/** Hooks the editor UI provides to blocks that need it (image picker). */
export interface BlockContext {
  requestImage: () => void;
}

const chain = (editor: Editor, range?: Range) => {
  const c = editor.chain().focus();
  return range ? c.deleteRange(range) : c;
};

const heading = (level: 1 | 2 | 3 | 4, icon: LucideIcon, description: string): BlockDefinition => ({
  id: `heading${String(level)}`,
  label: `Заголовок ${String(level)}`,
  description,
  icon,
  group: 'Текст',
  keywords: ['heading', `h${String(level)}`, 'заголовок', 'title'],
  convertible: true,
  run: (editor, range) => chain(editor, range).setNode('heading', { level }).run(),
  isActive: (editor) => editor.isActive('heading', { level }),
});

const callout = (
  variant: CalloutVariant,
  label: string,
  description: string,
  icon: LucideIcon,
  keywords: string[],
): BlockDefinition => ({
  id: `callout-${variant}`,
  label,
  description,
  icon,
  group: 'Примечания',
  keywords: [variant, 'callout', 'note', 'примечание', ...keywords],
  convertible: true,
  run: (editor, range) => chain(editor, range).setCallout(variant).run(),
  isActive: (editor) => editor.isActive('callout', { variant }),
});

export function blockDefinitions(ctx: BlockContext): BlockDefinition[] {
  return [
    {
      id: 'paragraph',
      label: 'Текст',
      description: 'Обычный абзац',
      icon: PilcrowIcon,
      group: 'Текст',
      keywords: ['text', 'paragraph', 'текст', 'абзац'],
      convertible: true,
      run: (editor, range) => chain(editor, range).setParagraph().run(),
      isActive: (editor) => editor.isActive('paragraph') && !editor.isActive('callout'),
    },
    heading(1, Heading1Icon, 'Крупный раздел'),
    heading(2, Heading2Icon, 'Раздел'),
    heading(3, Heading3Icon, 'Подраздел'),
    heading(4, Heading4Icon, 'Небольшой заголовок'),
    {
      id: 'blockquote',
      label: 'Цитата',
      description: 'Выделенная цитата',
      icon: QuoteIcon,
      group: 'Текст',
      keywords: ['quote', 'blockquote', 'цитата'],
      convertible: true,
      run: (editor, range) => chain(editor, range).toggleBlockquote().run(),
      isActive: (editor) => editor.isActive('blockquote'),
    },
    {
      id: 'codeBlock',
      label: 'Код',
      description: 'Блок кода с подсветкой',
      icon: CodeIcon,
      group: 'Текст',
      keywords: ['code', 'код', 'bash', 'powershell', 'script', 'скрипт'],
      convertible: true,
      run: (editor, range) => chain(editor, range).setCodeBlock({ language: 'bash' }).run(),
      isActive: (editor) => editor.isActive('codeBlock'),
    },
    {
      id: 'bulletList',
      label: 'Маркированный список',
      description: 'Список с точками',
      icon: ListIcon,
      group: 'Списки',
      keywords: ['list', 'bullet', 'ul', 'список'],
      convertible: true,
      run: (editor, range) => chain(editor, range).toggleBulletList().run(),
      isActive: (editor) => editor.isActive('bulletList'),
    },
    {
      id: 'orderedList',
      label: 'Нумерованный список',
      description: 'Шаги по порядку',
      icon: ListOrderedIcon,
      group: 'Списки',
      keywords: ['ordered', 'numbered', 'ol', 'нумерованный', 'шаги'],
      convertible: true,
      run: (editor, range) => chain(editor, range).toggleOrderedList().run(),
      isActive: (editor) => editor.isActive('orderedList'),
    },
    {
      id: 'taskList',
      label: 'Чек-лист',
      description: 'Список проверок с отметками',
      icon: ListChecksIcon,
      group: 'Списки',
      keywords: ['checklist', 'todo', 'task', 'чеклист', 'проверка', 'задачи'],
      convertible: true,
      run: (editor, range) => chain(editor, range).toggleTaskList().run(),
      isActive: (editor) => editor.isActive('taskList'),
    },
    callout('info', 'Информация', 'Полезное примечание', InfoIcon, ['info', 'информация', 'инфо']),
    callout('warning', 'Предупреждение', 'Важно учесть перед действием', CircleAlertIcon, [
      'warning',
      'внимание',
      'предупреждение',
    ]),
    callout('danger', 'Опасно', 'Критическое предупреждение', OctagonXIcon, [
      'danger',
      'error',
      'опасно',
      'критично',
    ]),
    callout('success', 'Рекомендация', 'Успешный результат или совет', CircleCheckIcon, [
      'success',
      'tip',
      'совет',
      'готово',
    ]),
    {
      id: 'image',
      label: 'Изображение',
      description: 'Загрузить или выбрать из медиатеки',
      icon: ImageIcon,
      group: 'Вставка',
      keywords: ['image', 'picture', 'img', 'картинка', 'изображение', 'скриншот'],
      convertible: false,
      run: (editor, range) => {
        chain(editor, range).run();
        ctx.requestImage();
      },
    },
    {
      id: 'table',
      label: 'Таблица',
      description: 'Таблица 3×3 с заголовком',
      icon: TableIcon,
      group: 'Вставка',
      keywords: ['table', 'таблица', 'grid'],
      convertible: false,
      run: (editor, range) =>
        chain(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'divider',
      label: 'Разделитель',
      description: 'Горизонтальная линия',
      icon: MinusIcon,
      group: 'Вставка',
      keywords: ['divider', 'hr', 'line', 'разделитель', 'линия'],
      convertible: false,
      run: (editor, range) => chain(editor, range).setHorizontalRule().run(),
    },
  ];
}

export function filterBlocks(blocks: BlockDefinition[], query: string): BlockDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return blocks;
  return blocks.filter(
    (b) => b.label.toLowerCase().includes(q) || b.keywords.some((k) => k.startsWith(q)),
  );
}
