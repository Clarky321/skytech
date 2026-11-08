'use client';

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'skytech-theme';

/**
 * Runs before first paint (inlined in <head>), so the page never flashes the wrong theme.
 * Kept tiny and dependency-free on purpose.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

const OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Светлая', icon: SunIcon },
  { value: 'dark', label: 'Тёмная', icon: MoonIcon },
  { value: 'system', label: 'Как в системе', icon: MonitorIcon },
];

function choose(next: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable (private mode): the theme still applies to this page
  }
  apply(next);
}

/** Mounted only while the menu is open (client only), so it can read storage directly. */
function ThemeOptions() {
  const current = readTheme();
  return OPTIONS.map(({ value, label, icon: Icon }) => (
    <DropdownMenuItem
      key={value}
      onSelect={() => {
        choose(value);
      }}
    >
      <Icon /> {label}
      {value === current ? <CheckIcon className="ml-auto" aria-label="выбрано" /> : null}
    </DropdownMenuItem>
  ));
}

export function ThemeToggle() {
  // Follow the OS theme live while "system" is selected.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readTheme() === 'system') apply('system');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Тема оформления">
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <ThemeOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
