import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission, Role } from '@skytech/contracts';
import type { Request } from 'express';

export const IS_PUBLIC = 'skytech:isPublic';
export const REQUIRED_PERMISSION = 'skytech:requiredPermission';

/** Opt-out of authentication. Every route is closed unless explicitly marked public. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route-level permission from the central map in @skytech/contracts. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.user) throw new Error('CurrentUser used on a route without authentication');
  return req.user;
});

/** Client IP as seen through trusted proxies (nginx in production, Next.js rewrite in dev). */
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ip ?? null;
});
