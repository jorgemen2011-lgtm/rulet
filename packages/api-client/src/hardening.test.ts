import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient, createMemoryTokenStore } from './index';
import { assertSafePath } from './url';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'user',
  email: 'b@x.io',
  name: null,
  createdAt: new Date().toISOString(),
};
const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(),
});
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('endurecimiento del cliente', () => {
  it('una petición de A enviada durante el login de B no se reintenta con los tokens de B', async () => {
    const loginGate = deferred();
    const transferGate = deferred();
    const seen: string[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).authorization;
      if (url.endsWith('/auth/login')) {
        await loginGate.promise;
        return json(200, { user, tokens: tokens(2) });
      }
      if (url.endsWith('/transfer')) {
        seen.push(String(auth));
        if (auth === 'Bearer access-1') {
          await transferGate.promise;
          return json(401, { statusCode: 401, error: 'Unauthorized', message: 'x' });
        }
        return json(200, { ok: true });
      }
      return json(404, {});
    }) as typeof globalThis.fetch;
    const api = createApiClient({
      platform: 'mobile',
      baseUrl: 'https://api.test',
      tokenStore: createMemoryTokenStore(tokens(1)),
      fetch,
    });

    const login = api.auth.login({ email: 'b@x.io', password: 'x' });
    await tick();
    const transfer = api
      .request(z.object({ ok: z.boolean() }), '/transfer', { method: 'POST', body: { amount: 100 } })
      .catch((e: unknown) => e);
    await tick();
    loginGate.resolve();
    await login;
    transferGate.resolve();

    expect(await transfer).toMatchObject({ status: 401 });
    expect(seen).toEqual(['Bearer access-1']);
  });

  it('rechaza respuestas que llegan tras una redirección (React Native ignora redirect: error)', async () => {
    const fetch = (async () => {
      const res = json(200, { status: 'ok' });
      Object.defineProperty(res, 'redirected', { value: true });
      return res;
    }) as typeof globalThis.fetch;
    const api = createApiClient({ platform: 'web', baseUrl: 'https://api.test', fetch });

    const error = await api.health().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'invalid_response' });
  });

  it.each(['/users/%2e%2e/admin', '/%2e%2e/health', '/a/%2E/b'])(
    'rechaza puntos codificados en la ruta: %s',
    (p) => {
      expect(() => assertSafePath(p)).toThrow();
    },
  );

  it('acepta %2e en la query string', () => {
    expect(() => assertSafePath('/search?q=%2e')).not.toThrow();
  });
});
