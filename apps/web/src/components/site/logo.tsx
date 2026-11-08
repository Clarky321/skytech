import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7', className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 20.5c0 1.9 2.4 3 5.4 3 3.3 0 5.6-1.5 5.6-4 0-2.3-1.7-3.3-5-3.9-2.4-.5-3.2-.9-3.2-1.8 0-.9 1-1.5 2.6-1.5 1.7 0 2.8.7 3 1.8"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M21 9.5h3.5M22.75 7.75v3.5"
        className="stroke-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 font-semibold tracking-tight"
      aria-label="SkyTech — на главную"
    >
      <LogoMark />
      <span className="text-[17px]">
        Sky<span className="text-primary">Tech</span>
      </span>
    </Link>
  );
}
