import type { ContentDraft } from '@skytech/contracts';

/**
 * Local safety net: unsaved editor state is mirrored to localStorage, so a crash, a closed
 * tab or a version conflict never loses work. The server stays the source of truth — a
 * backup is only offered back to the author, never saved automatically.
 */
export interface DraftBackup {
  draft: ContentDraft;
  /** Server version the backup was based on. */
  version: number;
  savedAt: string;
}

const key = (contentId: string) => `skytech:draft-backup:${contentId}`;

export function readBackup(contentId: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(key(contentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftBackup>;
    return parsed.draft && typeof parsed.version === 'number' && typeof parsed.savedAt === 'string'
      ? (parsed as DraftBackup)
      : null;
  } catch {
    return null;
  }
}

export function writeBackup(contentId: string, backup: DraftBackup): void {
  try {
    localStorage.setItem(key(contentId), JSON.stringify(backup));
  } catch {
    // Quota exceeded or storage disabled: the explicit save still works.
  }
}

export function clearBackup(contentId: string): void {
  try {
    localStorage.removeItem(key(contentId));
  } catch {
    // ignore
  }
}

/** Stable comparison of two drafts (key order independent for the top level). */
export function sameDraft(a: ContentDraft, b: ContentDraft): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(d: ContentDraft) {
  return {
    title: d.title.trim(),
    slug: d.slug,
    excerpt: d.excerpt.trim(),
    body: d.body,
    categoryId: d.categoryId,
    tagIds: [...d.tagIds].sort(),
    authorId: d.authorId,
    coverMediaId: d.coverMediaId,
    seoTitle: d.seoTitle.trim(),
    seoDescription: d.seoDescription.trim(),
  };
}
