'use client';

import { type ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const ToolbarButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { label: string; active?: boolean }
>(function ToolbarButton({ label, active = false, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the editor selection when clicking toolbar buttons.
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
        active && 'bg-accent text-accent-foreground hover:bg-accent',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
