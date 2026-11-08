import type { ContentDraft } from '@skytech/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearBackup, readBackup, sameDraft, writeBackup } from './draft-backup';

const draft: ContentDraft = {
  title: 'DNS',
  slug: 'dns',
  excerpt: '',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
  categoryId: null,
  tagIds: ['b', 'a'],
  authorId: null,
  coverMediaId: null,
  seoTitle: '',
  seoDescription: '',
};

describe('draft backup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a backup per material', () => {
    writeBackup('id-1', { draft, version: 3, savedAt: '2026-11-08T10:00:00.000Z' });
    expect(readBackup('id-1')).toEqual({ draft, version: 3, savedAt: '2026-11-08T10:00:00.000Z' });
    expect(readBackup('id-2')).toBeNull();
    clearBackup('id-1');
    expect(readBackup('id-1')).toBeNull();
  });

  it('ignores corrupted storage instead of crashing the editor', () => {
    localStorage.setItem('skytech:draft-backup:id-1', '{not json');
    expect(readBackup('id-1')).toBeNull();
    localStorage.setItem('skytech:draft-backup:id-1', JSON.stringify({ version: 1 }));
    expect(readBackup('id-1')).toBeNull();
  });

  it('compares drafts ignoring tag order and surrounding whitespace', () => {
    expect(sameDraft(draft, { ...draft, tagIds: ['a', 'b'], title: ' DNS ' })).toBe(true);
    expect(sameDraft(draft, { ...draft, title: 'DHCP' })).toBe(false);
    expect(
      sameDraft(draft, {
        ...draft,
        body: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'y' }] }],
        },
      }),
    ).toBe(false);
  });
});
