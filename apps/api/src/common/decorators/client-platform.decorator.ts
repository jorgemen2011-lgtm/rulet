import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CLIENT_PLATFORM_HEADER, isPlatform, Platform } from '@rulet/shared';
import type { Request } from 'express';

export function platformFromRequest(req: Request): Platform | undefined {
  const value = req.header(CLIENT_PLATFORM_HEADER);
  return isPlatform(value) ? value : undefined;
}

/** Inyecta la plataforma del cliente (`web` | `mobile`) o `undefined`. */
export const ClientPlatform = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  platformFromRequest(ctx.switchToHttp().getRequest<Request>()),
);
