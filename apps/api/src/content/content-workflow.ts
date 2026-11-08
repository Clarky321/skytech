import {
  type ContentAction,
  type ContentStatus,
  type ContentType,
  hasPermission,
  type Role,
} from '@skytech/contracts';

export interface WorkflowSubject {
  status: ContentStatus;
  createdBy: string | null;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
}

export interface WorkflowActor {
  id: string;
  role: Role;
}

export function canEdit(
  actor: WorkflowActor,
  subject: Pick<WorkflowSubject, 'createdBy'>,
): boolean {
  if (hasPermission(actor.role, 'content.edit_any')) return true;
  return hasPermission(actor.role, 'content.edit_own') && subject.createdBy === actor.id;
}

export function hasUnpublishedChanges(subject: WorkflowSubject): boolean {
  return subject.draftRevisionId !== subject.publishedRevisionId;
}

/**
 * The single source of truth for which workflow actions a user may perform.
 *
 *   draft ──submit──▶ review
 *   draft/review ──publish──▶ published      draft/review ──schedule──▶ scheduled
 *   scheduled ──publish──▶ published         scheduled ──unpublish──▶ draft (cancel)
 *   published ──publish (new revision)──▶ published
 *   published ──unpublish──▶ draft           any ──archive──▶ archived ──restore──▶ draft
 *
 * Authors never publish, schedule, unpublish or archive (permission `content.publish`).
 */
export function allowedActions(actor: WorkflowActor, subject: WorkflowSubject): ContentAction[] {
  const actions: ContentAction[] = [];
  const editable = canEdit(actor, subject);
  const publisher = hasPermission(actor.role, 'content.publish');
  const { status } = subject;

  if (editable && status !== 'archived') actions.push('edit');
  if (editable && !publisher && status === 'draft' && hasPermission(actor.role, 'content.submit')) {
    actions.push('submit');
  }
  if (publisher) {
    if (
      status === 'draft' ||
      status === 'review' ||
      status === 'scheduled' ||
      (status === 'published' && hasUnpublishedChanges(subject))
    ) {
      actions.push('publish');
    }
    if (status === 'draft' || status === 'review') actions.push('schedule');
    if (status === 'published' || status === 'scheduled') actions.push('unpublish');
    if (status !== 'archived') actions.push('archive');
    if (status === 'archived') actions.push('restore');
  }
  return actions;
}

export interface PublishableRevision {
  title: string;
  slug: string;
  categoryId: string | null;
  authorId: string | null;
  wordCount: number;
  hasImages: boolean;
}

/** Reasons that block publishing. Drafts may be saved incomplete; publishing may not. */
export function publishIssues(type: ContentType, rev: PublishableRevision): string[] {
  const issues: string[] = [];
  if (!rev.title.trim()) issues.push('Укажите заголовок');
  if (type === 'article' && !rev.categoryId) issues.push('Выберите категорию');
  if (type === 'article' && !rev.authorId) issues.push('Укажите автора');
  if (rev.wordCount === 0 && !rev.hasImages) issues.push('Добавьте содержимое');
  return issues;
}
