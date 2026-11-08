import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import {
  changePasswordSchema,
  type ChangePasswordInput,
  type CurrentUser as CurrentUserDto,
  loginSchema,
  type LoginInput,
  updateProfileSchema,
  type UpdateProfileInput,
} from '@skytech/contracts';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../platform/config.js';
import { ZodPipe } from '../platform/zod.pipe.js';
import { AuthService, toCurrentUser } from './auth.service.js';
import { type AuthUser, ClientIp, CurrentUser, Public } from './decorators.js';
import { readCookie, SESSION_COOKIE, SessionService } from './session.service.js';

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @ClientIp() ip: string | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUserDto> {
    const result = await this.auth.login(body, {
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });
    return result.user;
  }

  /** Public so an expired session can still clear its cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @ClientIp() ip: string | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = token ? await this.sessions.resolve(token) : null;
    if (user) await this.auth.logout(user, ip);
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): CurrentUserDto {
    return toCurrentUser(user);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput,
    @ClientIp() ip: string | null,
  ): Promise<CurrentUserDto> {
    return this.auth.updateProfile(user, body.displayName, ip);
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.auth.changePassword(user, body, ip);
  }
}
