'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { ImageOffIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useAdmin } from '@/components/admin/admin-context';
import { cn } from '@/lib/utils';

export interface ImageAttrs {
  mediaId: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mediaImage: {
      insertMediaImage: (attrs: ImageAttrs) => ReturnType;
    };
  }
}

function ImageView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as ImageAttrs;
  const { mediaSrc } = useAdmin();
  const [failed, setFailed] = useState(false);

  return (
    <NodeViewWrapper
      as="figure"
      className={cn('doc-image group/image relative', selected && 'is-selected')}
      data-drag-handle
    >
      {failed ? (
        <div className="flex aspect-video items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          <ImageOffIcon className="mr-2 size-4" /> Изображение недоступно
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- media is served from S3
        <img
          src={mediaSrc({ id: attrs.mediaId })}
          alt={attrs.alt}
          width={attrs.width ?? undefined}
          height={attrs.height ?? undefined}
          onError={() => {
            setFailed(true);
          }}
          draggable={false}
        />
      )}
      {editor.isEditable ? (
        <>
          <button
            type="button"
            contentEditable={false}
            onClick={() => {
              deleteNode();
            }}
            aria-label="Удалить изображение"
            className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md border bg-popover/95 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/image:opacity-100 hover:text-destructive focus-visible:opacity-100"
          >
            <Trash2Icon className="size-4" />
          </button>
          <div contentEditable={false} className="mt-2 grid gap-1.5">
            <input
              value={attrs.caption}
              onChange={(e) => {
                updateAttributes({ caption: e.target.value });
              }}
              placeholder="Подпись к изображению (необязательно)"
              aria-label="Подпись к изображению"
              maxLength={500}
              className="w-full bg-transparent text-center text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <input
              value={attrs.alt}
              onChange={(e) => {
                updateAttributes({ alt: e.target.value });
              }}
              placeholder="Альтернативный текст: что изображено (для доступности и SEO)"
              aria-label="Альтернативный текст"
              maxLength={300}
              className={cn(
                'mx-auto w-full max-w-md rounded-md border border-dashed bg-transparent px-2 py-1 text-center text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary',
                !attrs.alt && 'border-warning/60',
              )}
            />
          </div>
        </>
      ) : attrs.caption ? (
        <figcaption>{attrs.caption}</figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Image referenced by media id (ADR 0002): the document never stores arbitrary URLs. */
export const MediaImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    // Pasted <img> from elsewhere is not accepted: images must come from the media library.
    return [
      {
        tag: 'figure[data-media-id]',
        getAttrs: (el) => ({ mediaId: el.getAttribute('data-media-id') }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ 'data-media-id': HTMLAttributes.mediaId as string })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addCommands() {
    return {
      insertMediaImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
