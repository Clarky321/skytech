import { CONTENT_STATUSES, type ContentStatus } from '@skytech/contracts';
import { describe, expect, it } from 'vitest';
import { allowedActions, publishIssues, type WorkflowSubject } from './content-workflow.js';

const OWNER = 'owner-id';
const subject = (status: ContentStatus, extra: Partial<WorkflowSubject> = {}): WorkflowSubject => ({
  status,
  createdBy: OWNER,
  draftRevisionId: 'r2',
  publishedRevisionId: status === 'published' ? 'r1' : null,
  ...extra,
});

const author = { id: OWNER, role: 'author' as const };
const otherAuthor = { id: 'someone-else', role: 'author' as const };
const editor = { id: 'editor-id', role: 'editor' as const };
const admin = { id: 'admin-id', role: 'admin' as const };

describe('allowedActions', () => {
  it.each(CONTENT_STATUSES)('author never gets publishing actions (status %s)', (status) => {
    const actions = allowedActions(author, subject(status));
    for (const forbidden of ['publish', 'schedule', 'unpublish', 'archive', 'restore'] as const) {
      expect(actions).not.toContain(forbidden);
    }
  });

  it('author can edit and submit own draft', () => {
    expect(allowedActions(author, subject('draft'))).toEqual(['edit', 'submit']);
  });

  it('author cannot touch someone else’s material', () => {
    expect(allowedActions(otherAuthor, subject('draft'))).toEqual([]);
  });

  it('author keeps editing own published article (changes wait for an editor)', () => {
    expect(allowedActions(author, subject('published'))).toEqual(['edit']);
  });

  it('editor can publish a draft of any author', () => {
    expect(allowedActions(editor, subject('draft'))).toEqual([
      'edit',
      'publish',
      'schedule',
      'archive',
    ]);
  });

  it('publish on a published article is offered only when the draft differs', () => {
    expect(allowedActions(editor, subject('published', { draftRevisionId: 'r1' }))).toEqual([
      'edit',
      'unpublish',
      'archive',
    ]);
    expect(allowedActions(editor, subject('published'))).toContain('publish');
  });

  it('scheduled material can be published now or cancelled', () => {
    expect(allowedActions(admin, subject('scheduled'))).toEqual([
      'edit',
      'publish',
      'unpublish',
      'archive',
    ]);
  });

  it('archived material is read-only until restored', () => {
    expect(allowedActions(admin, subject('archived'))).toEqual(['restore']);
  });
});

describe('publishIssues', () => {
  const complete = {
    title: 'Настройка DNS',
    slug: 'nastroyka-dns',
    categoryId: 'c',
    authorId: 'a',
    wordCount: 10,
    hasImages: false,
  };

  it('accepts a complete article', () => {
    expect(publishIssues('article', complete)).toEqual([]);
  });

  it('lists every missing field of an article', () => {
    expect(
      publishIssues('article', {
        ...complete,
        title: ' ',
        categoryId: null,
        authorId: null,
        wordCount: 0,
      }),
    ).toEqual(['Укажите заголовок', 'Выберите категорию', 'Укажите автора', 'Добавьте содержимое']);
  });

  it('does not require category or author for pages', () => {
    expect(publishIssues('page', { ...complete, categoryId: null, authorId: null })).toEqual([]);
  });

  it('accepts image-only content', () => {
    expect(publishIssues('article', { ...complete, wordCount: 0, hasImages: true })).toEqual([]);
  });
});
