'use client';

import {
  type AdminContentDetail,
  type Author,
  type CategoryTreeNode,
  type ContentDraft,
  type SkyDocument,
  slugify,
  type Tag,
  urls,
} from '@skytech/contracts';
import type { Editor } from '@tiptap/core';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  CircleAlertIcon,
  CloudOffIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Tooltip,
} from '@/components/ui/menu';
import { Spinner } from '@/components/ui/misc';
import { toast } from '@/components/ui/toaster';
import { BlockEditor } from '@/editor/block-editor';
import { ApiError, api } from '@/lib/api/client';
import { formatDateTime, formatTime } from '@/lib/utils';
import { StatusBadge } from '../status-badge';
import { clearBackup, readBackup, sameDraft, writeBackup, type DraftBackup } from './draft-backup';
import { RevisionsDialog, ScheduleDialog } from './dialogs';
import { MetaPanel, type MetaDraft } from './meta-panel';

type SaveState =
  | { kind: 'clean'; at: Date | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict' };

const toMeta = ({ body: _body, ...meta }: ContentDraft): MetaDraft => meta;

/** Comparable form of a document: trailing empty paragraphs are editor spacing, not content. */
function documentKey(doc: SkyDocument): string {
  const content = [...doc.content];
  while (content.length > 1) {
    const last = content[content.length - 1];
    if (last?.type === 'paragraph' && !last.content?.length) content.pop();
    else break;
  }
  return JSON.stringify(content);
}

export function ContentEditor({
  initial,
  categories,
  authors,
  tags: initialTags,
}: {
  initial: AdminContentDetail;
  categories: CategoryTreeNode[];
  authors: Author[];
  tags: Tag[];
}) {
  const [detail, setDetail] = useState(initial);
  const [meta, setMeta] = useState<MetaDraft>(() => toMeta(initial.draft));
  const [tags, setTags] = useState(initialTags);
  const [save, setSave] = useState<SaveState>({ kind: 'clean', at: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backup, setBackup] = useState<DraftBackup | null>(null);

  // Latest values for async handlers (save/publish run across awaits).
  const detailRef = useRef(detail);
  const metaRef = useRef(meta);
  useLayoutEffect(() => {
    detailRef.current = detail;
    metaRef.current = meta;
  }, [detail, meta]);
  const bodyRef = useRef<SkyDocument>(initial.draft.body);
  const editorRef = useRef<Editor | null>(null);
  /** Incremented on every local change; a save only marks "clean" if nothing changed meanwhile. */
  const changes = useRef(0);
  const savingRef = useRef<Promise<AdminContentDetail | null> | null>(null);
  // While the slug follows the title automatically (never published, not edited by hand).
  const slugAuto = useRef(
    !initial.publishedSlug &&
      initial.draft.slug === (slugify(initial.draft.title) || initial.draft.slug),
  );

  const dirty = save.kind === 'dirty' || save.kind === 'error' || save.kind === 'conflict';
  const allowed = detail.allowedActions;
  const canEdit = allowed.includes('edit');
  const currentDraft = useCallback(
    (): ContentDraft => ({ ...metaRef.current, body: bodyRef.current }),
    [],
  );

  // ---- change tracking + local backup ---------------------------------------------------
  const backupTimer = useRef<number | undefined>(undefined);
  const markChanged = useCallback(() => {
    changes.current += 1;
    setSave((s) => (s.kind === 'conflict' ? s : { kind: 'dirty' }));
    window.clearTimeout(backupTimer.current);
    backupTimer.current = window.setTimeout(() => {
      writeBackup(detailRef.current.id, {
        draft: currentDraft(),
        version: detailRef.current.version,
        savedAt: new Date().toISOString(),
      });
    }, 800);
  }, [currentDraft]);

  const onMetaChange = useCallback(
    (patch: Partial<MetaDraft>, options?: { manualSlug?: boolean }) => {
      if (options?.manualSlug !== undefined) slugAuto.current = !options.manualSlug;
      setMeta((m) => {
        const next = { ...m, ...patch };
        if (patch.title !== undefined && slugAuto.current)
          next.slug = slugify(patch.title) || m.slug;
        return next;
      });
      for (const key of Object.keys(patch)) setErrors(({ [key]: _removed, ...rest }) => rest);
      markChanged();
    },
    [markChanged],
  );

  // Normalised JSON of the last known body: editor-internal transactions (selection, the
  // trailing empty paragraph TipTap keeps at the end) must not count as unsaved changes.
  const bodyKey = useRef(documentKey(initial.draft.body));
  const onBodyChange = useCallback(
    (doc: SkyDocument) => {
      bodyRef.current = doc;
      const key = documentKey(doc);
      if (key === bodyKey.current) return;
      bodyKey.current = key;
      markChanged();
    },
    [markChanged],
  );

  // Offer an unsaved local copy from a previous session (crash, closed tab, conflict).
  useEffect(() => {
    const found = readBackup(initial.id);
    // localStorage exists only in the browser, so this must run after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    if (found && !sameDraft(found.draft, initial.draft)) setBackup(found);
    else if (found) clearBackup(initial.id);
  }, [initial]);

  const applyDraft = useCallback((draft: ContentDraft) => {
    setMeta(toMeta(draft));
    bodyRef.current = draft.body;
    bodyKey.current = documentKey(draft.body);
    editorRef.current?.commands.setContent(draft.body, { emitUpdate: false });
  }, []);

  // ---- saving -----------------------------------------------------------------------------
  const handleError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.code === 'version_conflict') {
      setSave({ kind: 'conflict' });
      toast.error('Материал изменён в другом окне', {
        description: 'Ваши правки сохранены локально. Обновите страницу.',
      });
      return;
    }
    if (error instanceof ApiError && (error.status === 422 || error.status === 409)) {
      setErrors(error.fieldErrors());
      const list = error.problem?.errors?.map((e) => e.message).join('; ');
      toast.error(error.message, list ? { description: list } : undefined);
      setSave({ kind: 'error', message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : fallback;
    toast.error(message);
    setSave({ kind: 'error', message });
  }, []);

  const saveDraft = useCallback(async (): Promise<AdminContentDetail | null> => {
    if (savingRef.current) return savingRef.current;
    const startedAt = changes.current;
    setSave({ kind: 'saving' });
    const run = (async () => {
      try {
        const next = await api<AdminContentDetail>(`/admin/content/${detailRef.current.id}/draft`, {
          method: 'PUT',
          body: { ...currentDraft(), version: detailRef.current.version },
        });
        setDetail(next);
        setErrors({});
        // "Saved" only after the server confirmed, and only if nothing was typed meanwhile.
        if (changes.current === startedAt) {
          setSave({ kind: 'clean', at: new Date() });
          clearBackup(next.id);
        } else {
          setSave({ kind: 'dirty' });
        }
        return next;
      } catch (error) {
        handleError(error, 'Не удалось сохранить');
        return null;
      } finally {
        savingRef.current = null;
      }
    })();
    savingRef.current = run;
    return run;
  }, [currentDraft, handleError]);

  const ensureSaved = useCallback(async () => {
    if (save.kind === 'clean') return detailRef.current;
    return saveDraft();
  }, [save.kind, saveDraft]);

  // ---- workflow actions -----------------------------------------------------------------
  const runAction = useCallback(
    async (
      action: 'publish' | 'submit' | 'unpublish' | 'archive' | 'restore' | 'schedule',
      success: string,
      extra: Record<string, unknown> = {},
    ): Promise<boolean> => {
      setBusyAction(action);
      try {
        const base = action === 'restore' ? detailRef.current : await ensureSaved();
        if (!base) return false;
        const next = await api<AdminContentDetail>(`/admin/content/${base.id}/${action}`, {
          method: 'POST',
          body: { version: base.version, ...extra },
        });
        setDetail(next);
        toast.success(success);
        return true;
      } catch (error) {
        handleError(error, 'Действие не выполнено');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [ensureSaved, handleError],
  );

  const restoreRevision = useCallback(
    async (revisionId: string) => {
      try {
        const base = await ensureSaved();
        if (!base) return false;
        const next = await api<AdminContentDetail>(
          `/admin/content/${base.id}/revisions/${revisionId}/restore`,
          {
            method: 'POST',
            body: { version: base.version },
          },
        );
        setDetail(next);
        applyDraft(next.draft);
        setSave({ kind: 'clean', at: new Date() });
        toast.success('Версия восстановлена в черновик');
        return true;
      } catch (error) {
        handleError(error, 'Не удалось восстановить версию');
        return false;
      }
    },
    [ensureSaved, applyDraft, handleError],
  );

  const openPreview = useCallback(async () => {
    // Open the tab synchronously (popup blockers), then point it at the saved draft.
    const tab = window.open('about:blank', '_blank');
    const saved = await ensureSaved();
    if (saved && tab) tab.location.href = `/admin/preview/${saved.id}`;
    else tab?.close();
  }, [ensureSaved]);

  // ---- keyboard & navigation guards -------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEdit) void saveDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [saveDraft, canEdit]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    // Client-side navigation (sidebar links) bypasses beforeunload: confirm it explicitly.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest('a[href]');
      if (!link || link.getAttribute('target') === '_blank' || e.defaultPrevented) return;
      if (!window.confirm('Есть несохранённые изменения. Уйти со страницы?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const onEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // `false`: do not emit an update event (it would look like an unsaved change).
      editor.setEditable(canEdit, false);
    },
    [canEdit],
  );

  // ---- render -----------------------------------------------------------------------------
  const isArticle = detail.type === 'article';
  const liveUrl = detail.publishedSlug
    ? isArticle
      ? urls.article(detail.publishedSlug)
      : urls.page(detail.publishedSlug)
    : null;
  const primary = allowed.includes('publish')
    ? {
        action: 'publish' as const,
        label: detail.status === 'published' ? 'Опубликовать изменения' : 'Опубликовать',
        icon: SendIcon,
        success: 'Опубликовано',
      }
    : allowed.includes('submit')
      ? {
          action: 'submit' as const,
          label: 'Отправить на проверку',
          icon: SendIcon,
          success: 'Отправлено редактору на проверку',
        }
      : null;
  const blocked = primary?.action === 'publish' && detail.publishIssues.length > 0;

  return (
    <div className="pb-16">
      {/* Action bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="К списку">
            <Link href={isArticle ? '/admin/content' : '/admin/content?type=page'}>
              <ArrowLeftIcon />
            </Link>
          </Button>
          <StatusBadge status={detail.status} changed={detail.hasUnpublishedChanges} />
          {detail.status === 'scheduled' && detail.scheduledAt ? (
            <span className="text-xs text-muted-foreground">
              на {formatDateTime(detail.scheduledAt)}
            </span>
          ) : null}
          <SaveIndicator state={save} />

          <div className="ml-auto flex items-center gap-2">
            {liveUrl ? (
              <Button asChild variant="ghost" size="sm">
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> На сайте
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void openPreview()}>
              <EyeIcon /> Предпросмотр
            </Button>
            {canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveDraft()}
                disabled={save.kind === 'saving'}
              >
                {save.kind === 'saving' ? <Spinner /> : <SaveIcon />} Сохранить <Kbd>Ctrl S</Kbd>
              </Button>
            ) : null}
            {primary ? (
              <Tooltip
                content={
                  blocked
                    ? `Нельзя опубликовать: ${detail.publishIssues.join(', ')}`
                    : primary.label
                }
              >
                <span>
                  <Button
                    size="sm"
                    disabled={busyAction !== null || blocked}
                    onClick={() => void runAction(primary.action, primary.success)}
                    data-testid="primary-action"
                  >
                    {busyAction === primary.action ? <Spinner /> : <primary.icon />} {primary.label}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Ещё действия">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {allowed.includes('schedule') ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setScheduleOpen(true);
                    }}
                    disabled={detail.publishIssues.length > 0}
                  >
                    <CalendarClockIcon /> Запланировать…
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    setHistoryOpen(true);
                  }}
                >
                  <HistoryIcon /> История версий
                </DropdownMenuItem>
                {allowed.includes('unpublish') ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void runAction(
                        'unpublish',
                        detail.status === 'scheduled'
                          ? 'Публикация отменена'
                          : 'Снято с публикации',
                      )
                    }
                  >
                    <EyeOffIcon />{' '}
                    {detail.status === 'scheduled' ? 'Отменить планирование' : 'Снять с публикации'}
                  </DropdownMenuItem>
                ) : null}
                {allowed.includes('restore') ? (
                  <DropdownMenuItem
                    onSelect={() => void runAction('restore', 'Восстановлено в черновики')}
                  >
                    <RotateCcwIcon /> Восстановить из архива
                  </DropdownMenuItem>
                ) : null}
                {allowed.includes('archive') ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={() => void runAction('archive', 'Перемещено в архив')}
                    >
                      <ArchiveIcon /> В архив
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {save.kind === 'conflict' ? (
        <Banner tone="danger">
          Материал изменили в другом окне или другой пользователь. Ваши правки сохранены в этом
          браузере.{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              window.location.reload();
            }}
          >
            Обновить страницу
          </button>{' '}
          — после обновления можно будет восстановить локальную копию.
        </Banner>
      ) : null}
      {backup ? (
        <Banner tone="warning">
          Найдены несохранённые изменения от {formatDateTime(backup.savedAt)}
          {backup.version !== detail.version
            ? ' (сделаны на основе более старой версии)'
            : ''}.{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              applyDraft(backup.draft);
              setBackup(null);
              markChanged();
              toast.message('Локальная копия восстановлена — проверьте и сохраните');
            }}
          >
            Восстановить
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              clearBackup(detail.id);
              setBackup(null);
            }}
          >
            Отбросить
          </button>
        </Banner>
      ) : null}
      {!canEdit && detail.status !== 'archived' ? (
        <Banner tone="info">
          У вас нет прав на изменение этого материала — он открыт только для чтения.
        </Banner>
      ) : null}
      {detail.status === 'archived' ? (
        <Banner tone="info">Материал в архиве. Восстановите его, чтобы редактировать.</Banner>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="mb-5 grid gap-2">
            <label htmlFor="title" className="sr-only">
              Название
            </label>
            <textarea
              id="title"
              rows={1}
              value={meta.title}
              readOnly={!canEdit}
              onChange={(e) => {
                onMetaChange({ title: e.target.value.replace(/\n/g, ' ') });
              }}
              placeholder={isArticle ? 'Название статьи' : 'Название страницы'}
              aria-invalid={errors.title ? true : undefined}
              className="field-sizing-content w-full resize-none bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
              maxLength={200}
            />
            <label htmlFor="excerpt" className="sr-only">
              Краткое описание
            </label>
            <textarea
              id="excerpt"
              rows={2}
              value={meta.excerpt}
              readOnly={!canEdit}
              onChange={(e) => {
                onMetaChange({ excerpt: e.target.value });
              }}
              placeholder="Краткое описание: о чём материал и кому он поможет (показывается в списках и поиске)"
              className="field-sizing-content w-full resize-none bg-transparent text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50"
              maxLength={500}
            />
          </div>
          <BlockEditor
            initialContent={initial.draft.body}
            onChange={onBodyChange}
            onReady={onEditorReady}
          />
        </div>

        <aside className="grid min-w-0 grid-cols-1 content-start gap-4">
          {detail.publishIssues.length > 0 && allowed.includes('publish') ? (
            <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CircleAlertIcon className="size-4 text-warning" /> Перед публикацией
              </p>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {detail.publishIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Список обновляется после сохранения.
              </p>
            </div>
          ) : null}
          <fieldset disabled={!canEdit} className="contents">
            <MetaPanel
              type={detail.type}
              meta={meta}
              onChange={onMetaChange}
              errors={errors}
              categories={categories}
              tags={tags}
              authors={authors}
              slugLocked={detail.publishedSlug !== null}
              onTagCreated={(tag) => {
                setTags((t) => [...t, tag].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
              }}
            />
          </fieldset>
          <p className="px-1 text-xs text-muted-foreground">
            Создано: {detail.createdBy?.name ?? '—'} · изменено {formatDateTime(detail.updatedAt)}
          </p>
        </aside>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onConfirm={(scheduledAt) =>
          runAction('schedule', 'Публикация запланирована', { scheduledAt })
        }
      />
      <RevisionsDialog
        contentId={detail.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={restoreRevision}
        canRestore={canEdit}
      />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const base = 'flex items-center gap-1.5 text-xs';
  switch (state.kind) {
    case 'saving':
      return (
        <span className={`${base} text-muted-foreground`} role="status">
          <Spinner className="size-3" /> Сохранение…
        </span>
      );
    case 'dirty':
      return (
        <span className={`${base} text-warning`} role="status" data-testid="save-state">
          <span className="size-1.5 rounded-full bg-current" /> Есть несохранённые изменения
        </span>
      );
    case 'error':
      return (
        <span className={`${base} text-destructive`} role="status" data-testid="save-state">
          <CloudOffIcon className="size-3.5" /> Не сохранено
        </span>
      );
    case 'conflict':
      return (
        <span className={`${base} text-destructive`} role="status" data-testid="save-state">
          <CircleAlertIcon className="size-3.5" /> Конфликт версий
        </span>
      );
    case 'clean':
      return (
        <span className={`${base} text-muted-foreground`} role="status" data-testid="save-state">
          <CheckIcon className="size-3.5 text-success" />
          {state.at ? `Сохранено в ${formatTime(state.at)}` : 'Все изменения сохранены'}
        </span>
      );
  }
}

function Banner({
  tone,
  children,
}: {
  tone: 'danger' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  const styles = {
    danger: 'border-destructive/40 bg-destructive/10',
    warning: 'border-warning/50 bg-warning/10',
    info: 'border-primary/30 bg-primary/5',
  } as const;
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>
  );
}
