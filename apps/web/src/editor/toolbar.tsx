'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  BoldIcon,
  ChevronDownIcon,
  CodeXmlIcon,
  ItalicIcon,
  PanelTopIcon,
  Redo2Icon,
  StrikethroughIcon,
  TableCellsSplitIcon,
  Trash2Icon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import type { BlockDefinition } from './blocks';
import { LinkPopover } from './link-popover';
import { ToolbarButton, ToolbarDivider } from './toolbar-button';

const MARKS = [
  {
    name: 'bold',
    label: 'Жирный (Ctrl+B)',
    icon: BoldIcon,
    toggle: (e: Editor) => e.chain().focus().toggleBold().run(),
  },
  {
    name: 'italic',
    label: 'Курсив (Ctrl+I)',
    icon: ItalicIcon,
    toggle: (e: Editor) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: 'underline',
    label: 'Подчёркнутый (Ctrl+U)',
    icon: UnderlineIcon,
    toggle: (e: Editor) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: 'strike',
    label: 'Зачёркнутый',
    icon: StrikethroughIcon,
    toggle: (e: Editor) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: 'code',
    label: 'Код в строке (Ctrl+E)',
    icon: CodeXmlIcon,
    toggle: (e: Editor) => e.chain().focus().toggleCode().run(),
  },
] as const;

export function MarkButtons({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => Object.fromEntries(MARKS.map((m) => [m.name, e.isActive(m.name)])),
  });
  return (
    <>
      {MARKS.map((m) => {
        const Icon = m.icon;
        return (
          <ToolbarButton
            key={m.name}
            label={m.label}
            active={active[m.name]}
            onClick={() => m.toggle(editor)}
          >
            <Icon />
          </ToolbarButton>
        );
      })}
      <LinkPopover editor={editor} />
    </>
  );
}

/** Fixed toolbar above the document. Block insertion uses the same catalogue as "/" menu. */
export function Toolbar({ editor, blocks }: { editor: Editor; blocks: BlockDefinition[] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      inTable: e.isActive('table'),
      current: blocks.find((b) => b.convertible && b.isActive?.(e))?.label ?? 'Текст',
    }),
  });
  const convertible = blocks.filter((b) => b.convertible);
  const inserts = blocks.filter((b) => !b.convertible);

  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div
        role="toolbar"
        aria-label="Форматирование"
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
      >
        <ToolbarButton
          label="Отменить (Ctrl+Z)"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2Icon />
        </ToolbarButton>
        <ToolbarButton
          label="Повторить (Ctrl+Shift+Z)"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2Icon />
        </ToolbarButton>
        <ToolbarDivider />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton label="Тип блока" className="w-40 justify-between px-2 text-foreground">
              <span className="truncate">{state.current}</span>
              <ChevronDownIcon className="opacity-60" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-60"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            {convertible.map((b) => {
              const Icon = b.icon;
              return (
                <DropdownMenuItem
                  key={b.id}
                  onSelect={() => {
                    b.run(editor);
                  }}
                >
                  <Icon /> {b.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarDivider />

        <MarkButtons editor={editor} />
        <ToolbarDivider />

        {inserts.map((b) => {
          const Icon = b.icon;
          return (
            <ToolbarButton
              key={b.id}
              label={b.label}
              onClick={() => {
                b.run(editor);
              }}
            >
              <Icon />
            </ToolbarButton>
          );
        })}
        <span className="ml-auto hidden pr-1 text-xs text-muted-foreground md:inline">
          Нажмите <kbd className="rounded border bg-muted px-1 font-mono">/</kbd> для вставки блока
        </span>
      </div>

      {state.inTable ? <TableControls editor={editor} /> : null}
    </div>
  );
}

function TableControls({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) =>
    fn(editor.chain().focus()).run();
  return (
    <div
      role="toolbar"
      aria-label="Таблица"
      className="flex flex-wrap items-center gap-0.5 border-t bg-muted/40 px-2 py-1"
    >
      <span className="px-2 text-xs font-medium text-muted-foreground">Таблица</span>
      <ToolbarButton label="Строка выше" onClick={() => run((c) => c.addRowBefore())}>
        <BetweenHorizontalStartIcon />
      </ToolbarButton>
      <ToolbarButton label="Строка ниже" onClick={() => run((c) => c.addRowAfter())}>
        <BetweenHorizontalEndIcon />
      </ToolbarButton>
      <ToolbarButton label="Столбец слева" onClick={() => run((c) => c.addColumnBefore())}>
        <BetweenVerticalStartIcon />
      </ToolbarButton>
      <ToolbarButton label="Столбец справа" onClick={() => run((c) => c.addColumnAfter())}>
        <BetweenVerticalEndIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Строка заголовков" onClick={() => run((c) => c.toggleHeaderRow())}>
        <PanelTopIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Объединить / разделить ячейки"
        onClick={() => run((c) => c.mergeOrSplit())}
      >
        <TableCellsSplitIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton label="Удалить…" className="text-destructive hover:text-destructive">
            <Trash2Icon />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <DropdownMenuLabel>Удалить</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => run((c) => c.deleteRow())}>Строку</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run((c) => c.deleteColumn())}>Столбец</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => run((c) => c.deleteTable())}>
            Всю таблицу
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
