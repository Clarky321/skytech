import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

export interface TopLevelBlock {
  pos: number;
  node: PMNode;
  index: number;
}

/** The top-level block (direct child of the document) that contains `pos`. */
export function topLevelBlockAtPos(editor: Editor, pos: number): TopLevelBlock | null {
  const { doc } = editor.state;
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  const start = $pos.depth > 0 ? $pos.before(1) : pos;
  const node = doc.nodeAt(start);
  if (!node) return null;
  return { pos: start, node, index: doc.resolve(start).index(0) };
}

/** Same, from a DOM element under the mouse (used by the block handle). */
export function topLevelBlockAtDom(editor: Editor, element: Element): TopLevelBlock | null {
  try {
    return topLevelBlockAtPos(editor, editor.view.posAtDOM(element, 0));
  } catch {
    return null;
  }
}

function selectBlock(editor: Editor, pos: number, node: PMNode) {
  const { tr } = editor.state;
  const selection =
    node.isTextblock || node.content.size > 0
      ? TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)))
      : NodeSelection.create(tr.doc, pos);
  editor.view.dispatch(tr.setSelection(selection).scrollIntoView());
}

/** Moves a top-level block one position up or down. Returns false at the edges. */
export function moveBlock(editor: Editor, block: TopLevelBlock, direction: 'up' | 'down'): boolean {
  const { doc } = editor.state;
  const { pos, node, index } = block;
  let target: number;
  if (direction === 'up') {
    if (index === 0) return false;
    target = pos - doc.child(index - 1).nodeSize;
  } else {
    if (index >= doc.childCount - 1) return false;
    target = pos + doc.child(index + 1).nodeSize;
  }
  // "up": positions before `pos` are unaffected by deleting the block.
  // "down": after deleting, the next block starts at `pos`, so `pos + nextSize` is its end.
  const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
  tr.insert(target, node);
  editor.view.dispatch(tr);
  selectBlock(editor, target, node);
  editor.commands.focus();
  return true;
}

export function duplicateBlock(editor: Editor, block: TopLevelBlock): void {
  const at = block.pos + block.node.nodeSize;
  editor.view.dispatch(editor.state.tr.insert(at, block.node.copy(block.node.content)));
  selectBlock(editor, at, block.node);
  editor.commands.focus();
}

export function deleteBlock(editor: Editor, block: TopLevelBlock): void {
  const { tr } = editor.state;
  tr.delete(block.pos, block.pos + block.node.nodeSize);
  // Never leave the document empty: ProseMirror needs at least one block.
  if (tr.doc.childCount === 0) tr.insert(0, editor.schema.nodes.paragraph?.create() ?? []);
  editor.view.dispatch(tr);
  editor.commands.focus();
}

/** Puts the cursor inside the block so block commands ("turn into") apply to it. */
export function focusBlock(editor: Editor, block: TopLevelBlock): void {
  selectBlock(editor, block.pos, block.node);
}

/**
 * Starts a native ProseMirror drag of a whole block from the handle: ProseMirror moves the
 * slice stored in `view.dragging` on drop (same mechanism as dragging a selected node).
 */
export function startBlockDrag(
  editor: Editor,
  block: TopLevelBlock,
  event: DragEvent,
  element: HTMLElement,
): void {
  const { view } = editor;
  const selection = NodeSelection.create(view.state.doc, block.pos);
  view.dispatch(view.state.tr.setSelection(selection));
  (view as unknown as { dragging: { slice: unknown; move: boolean } | null }).dragging = {
    slice: selection.content(),
    move: true,
  };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', block.node.textContent);
    event.dataTransfer.setDragImage(element, 0, 0);
  }
}
