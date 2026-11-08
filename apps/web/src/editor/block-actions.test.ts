import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteBlock, duplicateBlock, moveBlock, topLevelBlockAtPos } from './block-actions';

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => {
    e.destroy();
  });
});

function editorWith(...paragraphs: string[]) {
  const editor = new Editor({
    extensions: [StarterKit.configure({ trailingNode: false })],
    content: {
      type: 'doc',
      content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    },
  });
  editors.push(editor);
  return editor;
}

const texts = (editor: Editor) => editor.state.doc.content.content.map((n) => n.textContent);

/** Position inside the n-th top-level block. */
function blockAt(editor: Editor, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
  const block = topLevelBlockAtPos(editor, pos + 1);
  if (!block) throw new Error('no block');
  return block;
}

describe('block actions', () => {
  it('resolves the top-level block from any inner position', () => {
    const editor = editorWith('один', 'два');
    const block = blockAt(editor, 1);
    expect(block.index).toBe(1);
    expect(block.node.textContent).toBe('два');
  });

  it('moves a block up and down', () => {
    const editor = editorWith('A', 'B', 'C');
    expect(moveBlock(editor, blockAt(editor, 1), 'up')).toBe(true);
    expect(texts(editor)).toEqual(['B', 'A', 'C']);
    expect(moveBlock(editor, blockAt(editor, 0), 'down')).toBe(true);
    expect(texts(editor)).toEqual(['A', 'B', 'C']);
    expect(moveBlock(editor, blockAt(editor, 1), 'down')).toBe(true);
    expect(texts(editor)).toEqual(['A', 'C', 'B']);
  });

  it('refuses to move past the edges', () => {
    const editor = editorWith('A', 'B');
    expect(moveBlock(editor, blockAt(editor, 0), 'up')).toBe(false);
    expect(moveBlock(editor, blockAt(editor, 1), 'down')).toBe(false);
    expect(texts(editor)).toEqual(['A', 'B']);
  });

  it('duplicates a block right after itself', () => {
    const editor = editorWith('A', 'B');
    duplicateBlock(editor, blockAt(editor, 0));
    expect(texts(editor)).toEqual(['A', 'A', 'B']);
  });

  it('deletes a block but never leaves the document empty', () => {
    const editor = editorWith('A', 'B');
    deleteBlock(editor, blockAt(editor, 0));
    expect(texts(editor)).toEqual(['B']);
    deleteBlock(editor, blockAt(editor, 0));
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
  });
});
