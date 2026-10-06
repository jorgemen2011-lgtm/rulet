import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { LoginRequestSchema } from '@rulet/shared';
import type { Request } from 'express';

const THROTTLE_BY_ACCOUNT = 'rulet:throttle-by-account';
const reflector = new Reflector();

/**
 * Activa en una ruta el límite por cuenta (además del de IP). El cuerpo debe traer `email`: el guard corre
 * antes de la validación, pero el cuerpo ya está parseado.
 */
export const ThrottleByAccount = () => SetMetadata(THROTTLE_BY_ACCOUNT, true);

/** Email normalizado como en el contrato, o `undefined` si no es válido (la validación responderá 400). */
function accountOf(context: ExecutionContext): string | undefined {
  const body: unknown = context.switchToHttp().getRequest<Request>().body;
  const email: unknown =
    typeof body === 'object' && body !== null ? (body as { email?: unknown }).email : undefined;
  const parsed = LoginRequestSchema.shape.email.safeParse(email);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Límite por cuenta: frena el password spraying / credential stuffing desde muchas IPs contra la misma
 * cuenta, que el límite por IP no ve. Cuenta todos los intentos (no revela si el email existe) y responde
 * el mismo 429 genérico que el límite por IP, sin cabeceras propias.
 * Contrapartida asumida: quien conozca un email puede bloquear su login durante la ventana (15 min).
 */
export const accountThrottler: ThrottlerOptions = {
  name: 'account',
  limit: 10,
  ttl: 15 * 60_000,
  setHeaders: false,
  skipIf: (context) =>
    !reflector.getAllAndOverride<boolean>(THROTTLE_BY_ACCOUNT, [context.getHandler(), context.getClass()]) ||
    accountOf(context) === undefined,
  // Solo se llama si `skipIf` no omite la petición, así que el email existe. La clave se guarda hasheada.
  getTracker: (_req, context) => `account:${accountOf(context) ?? ''}`,
};
