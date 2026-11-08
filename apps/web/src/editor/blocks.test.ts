import { describe, expect, it, vi } from 'vitest';
import { blockDefinitions, filterBlocks } from './blocks';

const blocks = blockDefinitions({ requestImage: vi.fn() });

describe('slash command catalogue', () => {
  it.each([
    ['heading', 'heading1'],
    ['заголовок', 'heading1'],
    ['image', 'image'],
    ['table', 'table'],
    ['code', 'codeBlock'],
    ['warning', 'callout-warning'],
    ['внимание', 'callout-warning'],
    ['info', 'callout-info'],
    ['quote', 'blockquote'],
    ['checklist', 'taskList'],
    ['danger', 'callout-danger'],
    ['success', 'callout-success'],
  ])('"/%s" offers %s first', (query, id) => {
    expect(filterBlocks(blocks, query)[0]?.id).toBe(id);
  });

  it('returns every block for an empty query and nothing for nonsense', () => {
    expect(filterBlocks(blocks, '')).toHaveLength(blocks.length);
    expect(filterBlocks(blocks, 'zzzz')).toEqual([]);
  });

  it('provides all 12 block types the editor promises', () => {
    const ids = new Set(blocks.map((b) => b.id));
    for (const id of [
      'paragraph',
      'heading1',
      'image',
      'codeBlock',
      'table',
      'blockquote',
      'callout-info',
      'callout-warning',
      'callout-danger',
      'callout-success',
      'divider',
      'taskList',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('marks only text-like blocks as convertible ("turn into")', () => {
    const fixed = blocks.filter((b) => !b.convertible).map((b) => b.id);
    expect(fixed.sort()).toEqual(['divider', 'image', 'table']);
  });
});
