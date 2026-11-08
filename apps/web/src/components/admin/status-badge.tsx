import { CONTENT_STATUS_LABELS, type ContentStatus } from '@skytech/contracts';
import { Badge } from '@/components/ui/badge';

const VARIANT: Record<ContentStatus, 'neutral' | 'warning' | 'default' | 'success' | 'outline'> = {
  draft: 'neutral',
  review: 'warning',
  scheduled: 'default',
  published: 'success',
  archived: 'outline',
};

export function StatusBadge({
  status,
  changed = false,
}: {
  status: ContentStatus;
  changed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={VARIANT[status]}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {CONTENT_STATUS_LABELS[status]}
      </Badge>
      {changed ? (
        <Badge variant="warning" title="Есть сохранённые, но не опубликованные изменения">
          изменения не опубликованы
        </Badge>
      ) : null}
    </span>
  );
}
