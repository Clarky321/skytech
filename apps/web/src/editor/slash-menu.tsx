'use client';

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { type BlockDefinition, filterBlocks } from './blocks';

interface SlashMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashMenuProps {
  items: BlockDefinition[];
  command: (item: BlockDefinition) => void;
}

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${String(index)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[index];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  let lastGroup = '';
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Вставить блок"
      className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</p>
      ) : (
        items.map((item, i) => {
          const showGroup = item.group !== lastGroup;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <div key={item.id}>
              {showGroup ? (
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {item.group}
                </p>
              ) : null}
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                data-index={i}
                onMouseEnter={() => {
                  setIndex(i);
                }}
                onClick={() => {
                  command(item);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left',
                  i === index && 'bg-muted',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
});

/**
 * `/` opens a block picker. Items come from the shared block catalogue (blocks.ts),
 * so the toolbar, the slash menu and "turn into" never disagree.
 */
export function createSlashCommand(getBlocks: () => BlockDefinition[]) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<BlockDefinition, BlockDefinition>({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          allowSpaces: false,
          // Not inside code blocks: "/" there is a path separator.
          allow: ({ editor }: { editor: Editor }) => !editor.isActive('codeBlock'),
          items: ({ query }) => filterBlocks(getBlocks(), query),
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: Range;
            props: BlockDefinition;
          }) => {
            props.run(editor, range);
          },
          render: () => {
            let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
            let element: HTMLDivElement | null = null;

            const place = (props: SuggestionProps<BlockDefinition, BlockDefinition>) => {
              const rect = props.clientRect?.();
              if (!element || !rect) return;
              const reference = { getBoundingClientRect: () => rect };
              void computePosition(reference, element, {
                placement: 'bottom-start',
                strategy: 'fixed',
                middleware: [offset(6), flip(), shift({ padding: 8 })],
              }).then(({ x, y }) => {
                if (element)
                  Object.assign(element.style, { left: `${String(x)}px`, top: `${String(y)}px` });
              });
            };

            return {
              onStart: (props) => {
                renderer = new ReactRenderer(SlashMenu, {
                  editor: props.editor,
                  props: { items: props.items, command: props.command },
                });
                element = document.createElement('div');
                element.style.position = 'fixed';
                element.style.zIndex = '60';
                element.appendChild(renderer.element);
                document.body.appendChild(element);
                place(props);
              },
              onUpdate: (props) => {
                renderer?.updateProps({ items: props.items, command: props.command });
                place(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  element?.remove();
                  return true;
                }
                return renderer?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                element?.remove();
                renderer?.destroy();
                element = null;
                renderer = null;
              },
            };
          },
        }),
      ];
    },
  });
}
