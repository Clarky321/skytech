import { FileQuestionIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SiteShell } from '@/components/site/shell';

export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <FileQuestionIcon className="size-12 text-muted-foreground" aria-hidden />
        <p className="mt-6 font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Страница не найдена</h1>
        <p className="mt-3 text-muted-foreground">
          Возможно, материал перенесли или сняли с публикации. Проверьте адрес или начните с
          главной.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">На главную</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/articles">Все статьи</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
