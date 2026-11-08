'use client';

import type { CurrentUser } from '@skytech/contracts';
import { ROLE_LABELS } from '@skytech/contracts';
import {
  FileTextIcon,
  FolderTreeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareWarningIcon,
  NotebookTextIcon,
  SquareArrowOutUpRightIcon,
  TagsIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LogoMark } from '@/components/site/logo';
import { ThemeToggle } from '@/components/theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileTextIcon;
  match: (path: string, type: string | null) => boolean;
}

const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: '/admin', label: 'Обзор', icon: LayoutDashboardIcon, match: (p) => p === '/admin' },
    ],
  },
  {
    title: 'Контент',
    items: [
      {
        href: '/admin/content',
        label: 'Статьи',
        icon: FileTextIcon,
        match: (p, t) => p.startsWith('/admin/content') && t !== 'page',
      },
      {
        href: '/admin/content?type=page',
        label: 'Страницы',
        icon: NotebookTextIcon,
        match: (p, t) => p.startsWith('/admin/content') && t === 'page',
      },
      {
        href: '/admin/media',
        label: 'Медиафайлы',
        icon: ImageIcon,
        match: (p) => p.startsWith('/admin/media'),
      },
    ],
  },
  {
    title: 'Структура',
    items: [
      {
        href: '/admin/categories',
        label: 'Категории',
        icon: FolderTreeIcon,
        match: (p) => p.startsWith('/admin/categories'),
      },
      {
        href: '/admin/tags',
        label: 'Теги',
        icon: TagsIcon,
        match: (p) => p.startsWith('/admin/tags'),
      },
      {
        href: '/admin/authors',
        label: 'Авторы',
        icon: UsersIcon,
        match: (p) => p.startsWith('/admin/authors'),
      },
    ],
  },
  {
    title: 'Обратная связь',
    items: [
      {
        href: '/admin/error-reports',
        label: 'Отчёты об ошибках',
        icon: MessageSquareWarningIcon,
        match: (p) => p.startsWith('/admin/error-reports'),
      },
    ],
  },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const type = useSearchParams().get('type');
  return (
    <nav
      aria-label="Разделы админки"
      className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4"
    >
      {NAV.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title ? (
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.title}
            </p>
          ) : null}
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = item.match(pathname, type);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 px-4 py-3.5 font-semibold tracking-tight"
    >
      <LogoMark className="size-6" />
      SkyTech <span className="font-normal text-muted-foreground">Редакция</span>
    </Link>
  );
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const logout = async () => {
    try {
      await api('/admin/auth/logout', { method: 'POST' });
    } catch {
      toast.error('Не удалось выйти — попробуйте ещё раз');
      return;
    }
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
      >
        <SquareArrowOutUpRightIcon className="size-4" /> Сайт
      </a>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-muted"
            aria-label="Меню пользователя"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-sm font-medium sm:inline">{user.displayName}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium text-foreground">{user.displayName}</span>
            <span className="block truncate">{user.email}</span>
            <span className="mt-1 block text-primary">{ROLE_LABELS[user.role]}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/profile">
              <UserIcon /> Профиль и пароль
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOutIcon /> Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
