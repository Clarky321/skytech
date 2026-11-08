'use client';

import { isSafeHref, type Media, type SkyDocument } from '@skytech/contracts';
import type { Editor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MediaPicker, uploadErrorMessage, uploadImage } from '@/components/admin/media-picker';
import { toast } from '@/components/ui/toaster';
import { BlockHandle } from './block-handle';
import { blockDefinitions } from './blocks';
import { Callout } from './extensions/callout';
import { CodeBlock } from './extensions/code-block';
import { MediaImage } from './extensions/image';
import { createSlashCommand } from './slash-menu';
import { MarkButtons, Toolbar } from './toolbar';

const imageAttrs = (media: Media) => ({
  mediaId: media.id,
  alt: media.alt,
  caption: '',
  width: media.width,
  height: media.height,
});

function insertMedia(editor: Editor, media: Media) {
  editor
    .chain()
    .focus()
    .insertContent({ type: 'image', attrs: imageAttrs(media) })
    .run();
}

/** Insertion straight on the ProseMirror view (used from paste/drop handlers). */
function insertMediaInView(view: EditorView, media: Media, at?: number) {
  const node = view.state.schema.nodes.image?.create(imageAttrs(media));
  if (!node) return;
  const tr =
    at === undefined ? view.state.tr.replaceSelectionWith(node) : view.state.tr.insert(at, node);
  view.dispatch(tr.scrollIntoView());
}

async function uploadAndInsert(view: EditorView, files: File[], at?: number) {
  for (const file of files) {
    const id = toast.loading(`Загрузка «${file.name}»…`);
    try {
      insertMediaInView(view, await uploadImage(file), at);
      toast.success('Изображение добавлено', { id });
    } catch (error) {
      toast.error(uploadErrorMessage(error), { id });
    }
  }
}

/**
 * The block editor (TipTap 3, ADR 0002). Emits a SkyTech document through `onChange`;
 * the server validates it again before storing (the editor is never trusted).
 */
export function BlockEditor({
  initialContent,
  onChange,
  onReady,
}: {
  initialContent: SkyDocument;
  onChange: (doc: SkyDocument) => void;
  onReady?: (editor: Editor) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const blocks = useMemo(
    () =>
      blockDefinitions({
        requestImage: () => {
          setPickerOpen(true);
        },
      }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => isSafeHref(url),
        },
      }),
      CodeBlock,
      Callout,
      MediaImage,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        includeChildren: false,
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Заголовок';
          return 'Начните писать или нажмите «/» для выбора блока';
        },
      }),
      createSlashCommand(() => blocks),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'article-body min-h-[60vh] pb-32 outline-none',
        'aria-label': 'Текст материала',
        spellcheck: 'true',
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        );
        if (files.length === 0) return false;
        void uploadAndInsert(view, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        );
        if (files.length === 0) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadAndInsert(view, files, at);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getJSON() as SkyDocument);
    },
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  if (!editor) {
    return (
      <div className="article-body min-h-[60vh] animate-pulse rounded-md bg-muted/40" aria-busy />
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Toolbar editor={editor} blocks={blocks} />
      <div
        ref={containerRef}
        className="relative px-4 pt-6 sm:pr-10 sm:pl-16"
        data-testid="block-editor"
      >
        <BlockHandle editor={editor} container={containerRef} blocks={blocks} />
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          shouldShow={({ editor: e, state }) =>
            !state.selection.empty && !e.isActive('codeBlock') && !e.isActive('image')
          }
          className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
        >
          <MarkButtons editor={editor} />
        </BubbleMenu>
        <EditorContent editor={editor} />
      </div>
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(media) => {
          insertMedia(editor, media);
        }}
      />
    </div>
  );
}
