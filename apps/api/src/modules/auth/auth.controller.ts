import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthResponse,
  type LoginRequest,
  LoginRequestSchema,
  type LogoutRequest,
  LogoutRequestSchema,
  type Platform,
  type RefreshRequest,
  RefreshRequestSchema,
  type RegisterRequest,
  RegisterRequestSchema,
} from '@rulet/shared';
import type { Request, Response } from 'express';
import { clearAuthCookies, readRefreshCookie, setAuthCookies } from '../../common/auth/auth-cookies.js';
import { ClientPlatform } from '../../common/decorators/client-platform.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequiredPlatformPipe } from '../../common/pipes/required-platform.pipe.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { type AuthResult, AuthService } from './auth.service.js';

const ONE_MINUTE_MS = 60_000;

/**
 * Endpoints de autenticación. Este controller solo decide el TRANSPORTE según la plataforma:
 * - mobile: tokens en el cuerpo (el cliente los guarda en el almacén seguro del dispositivo);
 * - web: tokens en cookies httpOnly, nunca en el cuerpo (inaccesibles para JavaScript ante un XSS).
 */
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: ONE_MINUTE_MS } })
  async register(
    @ClientPlatform(RequiredPlatformPipe) platform: Platform,
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(platform, res, await this.auth.register(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE_MS } })
  async login(
    @ClientPlatform(RequiredPlatformPipe) platform: Platform,
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(platform, res, await this.auth.login(body));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: ONE_MINUTE_MS } })
  async refresh(
    @ClientPlatform(RequiredPlatformPipe) platform: Platform,
    @Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(platform, res, await this.auth.refresh(this.refreshTokenFrom(platform, body, req)));
  }

  /** No exige access token (puede haber caducado). Siempre 204 y borra las cookies. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @ClientPlatform(RequiredPlatformPipe) platform: Platform,
    @Body(new ZodValidationPipe(LogoutRequestSchema)) body: LogoutRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.refreshTokenFrom(platform, body, req));
    clearAuthCookies(res, this.config.get('COOKIE_SECURE'));
  }

  /** Cada plataforma tiene una única fuente del refresh token; nunca se mezclan. */
  private refreshTokenFrom(platform: Platform, body: RefreshRequest, req: Request): string | undefined {
    return platform === 'web' ? readRefreshCookie(req, this.config.get('COOKIE_SECURE')) : body.refreshToken;
  }

  private respond(platform: Platform, res: Response, result: AuthResult): AuthResponse {
    if (platform === 'mobile') return { user: result.user, tokens: result.tokens };
    setAuthCookies(res, result.tokens, this.config.get('COOKIE_SECURE'));
    return { user: result.user };
  }
}
