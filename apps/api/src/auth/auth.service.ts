import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type ChangePasswordInput,
  type CurrentUser,
  hasPermission,
  type LoginInput,
  PERMISSIONS,
  type Permission,
  type Role,
} from '@skytech/contracts';
import { AuditService } from '../audit/audit.service.js';
import { DB, type Db } from '../platform/db.js';
import { ProblemException } from '../platform/problem.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './decorators.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.js';
import { RateLimiter } from './rate-limiter.js';
import { SessionService } from './session.service.js';

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

export function toCurrentUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
      hasPermission(user.role, p),
    ),
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
  ) {}

  async login(
    input: LoginInput,
    meta: { ip: string | null; userAgent: string | null },
  ): Promise<{ token: string; expiresAt: Date; user: CurrentUser }> {
    const limits = [
      {
        key: `login:email:${input.email}`,
        max: MAX_FAILURES_PER_EMAIL,
        windowSeconds: WINDOW_SECONDS,
      },
      {
        key: `login:ip:${meta.ip ?? 'unknown'}`,
        max: MAX_FAILURES_PER_IP,
        windowSeconds: WINDOW_SECONDS,
      },
    ];
    await this.limiter.assertAllowed(limits);

    const user = await this.users.findByEmail(input.email);
    // Always run Argon2 so response time does not reveal whether the email exists.
    const valid = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );

    if (!user || !valid || !user.isActive) {
      await this.limiter.hit(limits);
      await this.audit.record(this.db, {
        actorUserId: null,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        ip: meta.ip,
      });
      throw new ProblemException(HttpStatus.UNAUTHORIZED, 'Неверный email или пароль');
    }

    await this.limiter.reset([limits[0]?.key ?? '']);
    const session = await this.db.transaction(async (tx) => {
      const created = await this.sessions.create(tx, user.id, meta);
      await this.users.markLogin(tx, user.id);
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        ip: meta.ip,
      });
      return created;
    });
    return { token: session.token, expiresAt: session.expiresAt, user: toCurrentUser(user) };
  }

  async logout(user: AuthUser, ip: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.sessions.revoke(tx, user.sessionId);
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: user.id,
        ip,
      });
    });
  }

  async updateProfile(
    user: AuthUser,
    displayName: string,
    ip: string | null,
  ): Promise<CurrentUser> {
    await this.db.transaction(async (tx) => {
      await this.users.updateDisplayName(tx, user.id, displayName);
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'user.profile_update',
        entityType: 'user',
        entityId: user.id,
        diff: { displayName: { from: user.displayName, to: displayName } },
        ip,
      });
    });
    return toCurrentUser({ ...user, displayName });
  }

  async changePassword(
    user: AuthUser,
    input: ChangePasswordInput,
    ip: string | null,
  ): Promise<void> {
    const limits = [{ key: `password:user:${user.id}`, max: 5, windowSeconds: WINDOW_SECONDS }];
    await this.limiter.assertAllowed(limits);
    const row = await this.users.findById(user.id);
    if (!row || !(await verifyPassword(row.passwordHash, input.currentPassword))) {
      await this.limiter.hit(limits);
      throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, 'Текущий пароль указан неверно', [
        { path: 'currentPassword', message: 'Неверный пароль' },
      ]);
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.db.transaction(async (tx) => {
      // Other sessions are signed out; the current one stays.
      await this.users.setPasswordHash(tx, user.id, passwordHash, user.sessionId);
      await this.audit.record(tx, {
        actorUserId: user.id,
        action: 'user.password_change',
        entityType: 'user',
        entityId: user.id,
        ip,
      });
    });
  }
}
