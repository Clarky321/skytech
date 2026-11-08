'use client';

import type { Editor } from '@tiptap/core';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { cn } from '@/lib/utils';
import {
  deleteBlock,
  duplicateBlock,
  focusBlock,
  moveBlock,
  startBlockDrag,
  type TopLevelBlock,
  topLevelBlockAtDom,
} from './block-actions';
import type { BlockDefinition } from './blocks';

interface HandleState {
  block: TopLevelBlock;
  element: HTMLElement;
  top: number;
}

/**
 * Notion-style handle in the left gutter: "+" inserts a block below, the grip opens the
 * block menu and can be dragged to move the block (ProseMirror's native drag & drop).
 */
export function BlockHandle({
  editor,
  container,
  blocks,
}: {
  editor: Editor;
  container: RefObject<HTMLDivElement | null>;
  blocks: BlockDefinition[];
}) {
  const [state, setState] = useState<HandleState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  useLayoutEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    const wrapper = container.current;
    if (!wrapper) return;
    const locate = (target: EventTarget | null) => {
      const root = editor.view.dom;
      let el = target instanceof Element ? target : null;
      while (el && el.parentElement !== root) el = el.parentElement;
      if (!el || !(el instanceof HTMLElement)) return;
      const block = topLevelBlockAtDom(editor, el);
      if (!block) return;
      const top = el.getBoundingClientRect().top - wrapper.getBoundingClientRect().top;
      setState({ block, element: el, top });
    };
    const onMove = (e: MouseEvent) => {
      if (!menuOpenRef.current) locate(e.target);
    };
    const onLeave = () => {
      if (!menuOpenRef.current) setState(null);
    };
    // Document changes shift positions: forget the cached block until the mouse moves again.
    const onUpdate = () => {
      if (!menuOpenRef.current) setState(null);
    };
    wrapper.addEventListener('mousemove', onMove);
    wrapper.addEventListener('mouseleave', onLeave);
    editor.on('update', onUpdate);
    return () => {
      wrapper.removeEventListener('mousemove', onMove);
      wrapper.removeEventListener('mouseleave', onLeave);
      editor.off('update', onUpdate);
    };
  }, [editor, container]);

  if (!state || !editor.isEditable) return null;
  const { block } = state;
  const isFirst = block.index === 0;
  const isLast = block.index === editor.state.doc.childCount - 1;
  const convertible = blocks.filter((b) => b.convertible);
  const canConvert =
    block.node.isTextblock ||
    ['bulletList', 'orderedList', 'taskList', 'blockquote', 'callout'].includes(
      block.node.type.name,
    );

  const insertBelow = () => {
    const at = block.pos + block.node.nodeSize;
    editor
      .chain()
      .insertContentAt(at, { type: 'paragraph' })
      .setTextSelection(at + 1)
      .insertContent('/')
      .focus()
      .run();
  };

  const onDragStart = (e: React.DragEvent) => {
    startBlockDrag(editor, block, e.nativeEvent, state.element);
  };

  return (
    <div
      className="absolute left-0 z-10 flex items-center gap-0.5 transition-[top] duration-75"
      style={{ top: state.top + 2 }}
      contentEditable={false}
    >
      <button
        type="button"
        onClick={insertBelow}
        aria-label="Добавить блок ниже"
        title="Добавить блок ниже"
        className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <PlusIcon className="size-4" />
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            aria-label="Действия с блоком (перетащите, чтобы переместить)"
            title="Перетащите или нажмите для меню"
            className={cn(
              'flex h-6 w-5 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing',
              menuOpen && 'bg-muted text-foreground',
            )}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="left" className="w-56">
          <DropdownMenuItem disabled={isFirst} onSelect={() => moveBlock(editor, block, 'up')}>
            <ArrowUpIcon /> Переместить вверх
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onSelect={() => moveBlock(editor, block, 'down')}>
            <ArrowDownIcon /> Переместить вниз
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              duplicateBlock(editor, block);
            }}
          >
            <CopyIcon /> Дублировать
          </DropdownMenuItem>
          {canConvert ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Превратить в</DropdownMenuLabel>
              <div className="max-h-56 overflow-y-auto">
                {convertible.map((b) => {
                  const Icon = b.icon;
                  return (
                    <DropdownMenuItem
                      key={b.id}
                      onSelect={() => {
                        focusBlock(editor, block);
                        b.run(editor);
                      }}
                    >
                      <Icon /> {b.label}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => {
              deleteBlock(editor, block);
            }}
          >
            <Trash2Icon /> Удалить блок
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
