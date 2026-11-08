'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-lg! border-border! bg-popover! text-popover-foreground! shadow-lg!',
          description: 'text-muted-foreground!',
        },
      }}
    />
  );
}
