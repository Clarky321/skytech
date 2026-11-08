import { MessageSquareWarningIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Отчёты об ошибках' };

/** Honest placeholder: the feature is planned (docs/plan.md, Phase 4.4 / 6.3), not faked. */
export default function ErrorReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Отчёты об ошибках"
        description="Сообщения читателей об опечатках и неточностях (выделение текста + Ctrl+Enter)."
      />
      <EmptyState
        icon={<MessageSquareWarningIcon />}
        title="Раздел в разработке"
        description="Приём сообщений от читателей ещё не включён: backend (honeypot, rate limit, хэш IP) и форма на сайте запланированы следующим этапом. Здесь появится очередь сообщений со статусами «новое», «исправлено», «отклонено»."
      />
    </div>
  );
}
