import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface FakeRequestInit {
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

/** Petición mínima de Express para probar guards sin levantar la aplicación. */
export function fakeRequest(init: FakeRequestInit = {}): Request {
  const headers = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method: init.method ?? 'GET',
    headers,
    cookies: init.cookies ?? {},
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

/** `ExecutionContext` HTTP con handler y clase dados (de ellos lee el Reflector los metadatos). */
export function httpContext(
  req: Request,
  handler: (...args: unknown[]) => unknown = () => undefined,
  cls: abstract new (...args: never[]) => unknown = class {},
): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}
