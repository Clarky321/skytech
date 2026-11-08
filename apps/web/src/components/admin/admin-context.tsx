'use client';

import { type CurrentUser, type Media, mediaUrl, type Permission } from '@skytech/contracts';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

interface AdminContextValue {
  user: CurrentUser;
  mediaBaseUrl: string;
  /** Cosmetic only — the API enforces every permission. */
  can: (permission: Permission) => boolean;
  mediaSrc: (media: Pick<Media, 'full'> | { id: string }) => string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  user,
  mediaBaseUrl,
  children,
}: {
  user: CurrentUser;
  mediaBaseUrl: string;
  children: ReactNode;
}) {
  const value = useMemo<AdminContextValue>(
    () => ({
      user,
      mediaBaseUrl,
      can: (permission) => user.permissions.includes(permission),
      // Keys are deterministic: media/<id>/full.webp (see MediaService).
      mediaSrc: (media) =>
        mediaUrl(mediaBaseUrl, 'full' in media ? media.full.key : `media/${media.id}/full.webp`),
    }),
    [user, mediaBaseUrl],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider');
  return ctx;
}
