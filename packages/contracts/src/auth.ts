import { z } from 'zod';

export const ROLES = ['admin', 'editor', 'author'] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  editor: 'Редактор',
  author: 'Автор',
};

/**
 * Central permission map. The backend is the only place where these are enforced;
 * the frontend reads them only to hide controls (cosmetic).
 */
export const PERMISSIONS = {
  'content.create': ['admin', 'editor', 'author'],
  'content.edit_own': ['admin', 'editor', 'author'],
  'content.edit_any': ['admin', 'editor'],
  'content.submit': ['admin', 'editor', 'author'],
  /** publish, schedule, unpublish, archive, restore from archive */
  'content.publish': ['admin', 'editor'],
  'taxonomy.manage': ['admin', 'editor'],
  'authors.manage': ['admin', 'editor'],
  'media.upload': ['admin', 'editor', 'author'],
  'media.delete': ['admin', 'editor'],
  'users.manage': ['admin'],
  'audit.read': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const PASSWORD_MIN_LENGTH = 12;

export const loginSchema = z.object({
  // Normalise first, then validate, so ' Admin@Example.ru ' is accepted as admin@example.ru.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(1024),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Минимум ${PASSWORD_MIN_LENGTH} символов`)
    .max(1024),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  permissions: Permission[];
}
