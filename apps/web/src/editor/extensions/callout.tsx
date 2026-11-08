'use client';

import { CALLOUT_VARIANTS, type CalloutVariant } from '@skytech/contracts';
import { mergeAttributes, Node } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, OctagonXIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CALLOUT_META: Record<
  CalloutVariant,
  { label: string; icon: typeof InfoIcon; color: string }
> = {
  info: { label: 'Информация', icon: InfoIcon, color: 'var(--callout-info-border)' },
  warning: { label: 'Внимание', icon: CircleAlertIcon, color: 'var(--callout-warning-border)' },
  danger: { label: 'Опасно', icon: OctagonXIcon, color: 'var(--callout-danger-border)' },
  success: { label: 'Рекомендация', icon: CircleCheckIcon, color: 'var(--callout-success-border)' },
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps the current block(s) into a callout, or changes the variant of the current one. */
      setCallout: (variant: CalloutVariant) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const variant = (node.attrs as { variant: CalloutVariant }).variant;
  return (
    <NodeViewWrapper
      as="aside"
      data-type="callout"
      data-variant={variant}
      className="group/callout"
    >
      {editor.isEditable ? (
        <div
          contentEditable={false}
          className="absolute top-1.5 right-1.5 flex gap-0.5 rounded-md border bg-popover p-0.5 opacity-0 shadow-sm transition-opacity group-hover/callout:opacity-100 focus-within:opacity-100"
        >
          {CALLOUT_VARIANTS.map((v) => {
            const meta = CALLOUT_META[v];
            const Icon = meta.icon;
            return (
              <button
                key={v}
                type="button"
                title={meta.label}
                aria-label={`Тип: ${meta.label}`}
                aria-pressed={v === variant}
                onClick={() => {
                  updateAttributes({ variant: v });
                }}
                className={cn(
                  'flex size-6 items-center justify-center rounded-sm hover:bg-muted',
                  v === variant && 'bg-muted',
                )}
              >
                <Icon className="size-3.5" style={{ color: meta.color }} />
              </button>
            );
          })}
        </div>
      ) : null}
      <div contentEditable={false} className="callout__title select-none">
        {CALLOUT_META[variant].label}
      </div>
      <NodeViewContent className="callout__body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el) => {
          const v = el.getAttribute('data-variant');
          return (CALLOUT_VARIANTS as readonly string[]).includes(v ?? '') ? v : 'info';
        },
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (variant) =>
        ({ editor, commands }) =>
          editor.isActive(this.name)
            ? commands.updateAttributes(this.name, { variant })
            : commands.wrapIn(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});
