import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@skytech/contracts';
import { APP_CONFIG, type AppConfig } from '../platform/config.js';
import { ProblemException, forbidden } from '../platform/problem.js';
import { type AuthenticatedRequest, IS_PUBLIC, REQUIRED_PERMISSION } from './decorators.js';
import { readCookie, SESSION_COOKIE, SessionService } from './session.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie sessions: every state-changing request must carry an Origin
 * header equal to the site origin. Requests without Origin are rejected (SameSite=Lax is
 * the second layer). Applies to public routes too (login, error reports).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.headers.origin;
    if (origin !== this.config.APP_ORIGIN) {
      throw new ProblemException(
        HttpStatus.FORBIDDEN,
        'Запрос отклонён: недопустимый источник (CSRF)',
        undefined,
        'csrf',
      );
    }
    return true;
  }
}

/** Deny-by-default authentication + permission check from the central permission map. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.sessions.resolve(token) : null;
    if (!user) {
      throw new ProblemException(
        HttpStatus.UNAUTHORIZED,
        'Войдите в систему',
        undefined,
        'unauthenticated',
      );
    }
    req.user = user;

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    if (permission && !hasPermission(user.role, permission)) throw forbidden();
    return true;
  }
}
