import type { AuthTokens, User } from '@rulet/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from './client';
import type { ApiClientOptions } from './client';
import { ApiError } from './errors';
import { createMemoryTokenStore } from './token-store';
import type { TokenStore } from './token-store';

const BASE = 'https://api.rulet.test';

const user: User = {
  id: '6f1c2a0e-6c3f-4c1e-9a52-2b8f6f0d9a11',
  email: 'ana@rulet.app',
  name: 'Ana',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function tokens(n: number): AuthTokens {
  return {
    accessToken: `access-${n}`,
    accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
    refreshToken: `refresh-${n}`,
    refreshTokenExpiresAt: '2026-01-31T00:00:00.000Z',
  };
}

function errorBody(statusCode: number, message: string) {
  return {
    statusCode,
    error: 'Error',
    message,
    path: '/v1/test',
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface Recorded {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (req: Recorded) => Response | Promise<Response>;

/** `fetch` simulado que registra cada llamada y delega la respuesta en `handler`. */
function mockFetch(handler: Handler) {
  const calls: Recorded[] = [];
  const fn = vi.fn((input: string | URL | Request, init: RequestInit = {}) => {
    const req: Recorded = {
      url: String(input),
      init,
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(req);
    return Promise.resolve(handler(req));
  });
  const callsTo = (path: string) => calls.filter((c) => new URL(c.url).pathname === path);
  return { fetch: fn as unknown as typeof fetch, calls, callsTo };
}

function spyStore(
  initial: AuthTokens | null,
): TokenStore & { [K in keyof TokenStore]: ReturnType<typeof vi.fn> } {
  const store = createMemoryTokenStore(initial);
  return {
    get: vi.fn(store.get),
    set: vi.fn(store.set),
    clear: vi.fn(store.clear),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('configuración', () => {
  it.each(['http://api.rulet.app', 'http://192.168.1.10:3000', 'ftp://api.rulet.app', 'api.rulet.app', ''])(
    'rechaza baseUrl insegura o inválida: %s',
    (baseUrl) => {
      expect(() => createApiClient({ baseUrl, platform: 'web' })).toThrow();
    },
  );

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.0.2.2:3000', 'http://[::1]:3000'])(
    'permite http:// en hosts locales: %s',
    (baseUrl) => {
      expect(() => createApiClient({ baseUrl, platform: 'web' })).not.toThrow();
    },
  );

  it('permite http:// no local solo con allowInsecureHttp', () => {
    expect(() =>
      createApiClient({ baseUrl: 'http://api.staging.internal', platform: 'web', allowInsecureHttp: true }),
    ).not.toThrow();
  });

  it('rechaza credenciales embebidas en baseUrl', () => {
    expect(() => createApiClient({ baseUrl: 'https://u:p@api.rulet.app', platform: 'web' })).toThrow(
      /credenciales/,
    );
  });

  it('exige tokenStore en mobile', () => {
    const options = { baseUrl: BASE, platform: 'mobile' } as unknown as ApiClientOptions;
    expect(() => createApiClient(options)).toThrow(/tokenStore/);
  });

  it('rechaza timeoutMs no positivo', () => {
    expect(() => createApiClient({ baseUrl: BASE, platform: 'web', timeoutMs: 0 })).toThrow(/timeoutMs/);
  });

  it('normaliza la barra final de baseUrl', async () => {
    const { fetch, calls } = mockFetch(() => json(200, user));
    const api = createApiClient({ baseUrl: `${BASE}/`, platform: 'web', fetch });
    await api.users.me();
    expect(calls[0]?.url).toBe(`${BASE}/v1/users/me`);
  });
});

describe('transporte web', () => {
  it('usa cookies (credentials include), sin Authorization, y marca la plataforma', async () => {
    const { fetch, calls } = mockFetch(() => json(200, user));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.users.me()).resolves.toEqual(user);

    const [call] = calls;
    expect(call?.init.credentials).toBe('include');
    expect(call?.init.redirect).toBe('error');
    expect(call?.headers['x-client-platform']).toBe('web');
    expect(call?.headers).not.toHaveProperty('authorization');
  });

  it('login no toca el tokenStore (se ignora en web) y no devuelve tokens', async () => {
    const store = spyStore(null);
    const { fetch, calls } = mockFetch(() => json(200, { user, tokens: tokens(1) }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', tokenStore: store, fetch });

    const result = await api.auth.login({ email: user.email, password: 'contraseña-larga' });

    expect(result).toEqual({ user });
    expect(store.set).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toEqual({ email: user.email, password: 'contraseña-larga' });
  });

  it('refresh y logout envían cuerpo vacío (el refresh token va en la cookie)', async () => {
    const { fetch, callsTo } = mockFetch((req) =>
      req.url.endsWith('/logout') ? new Response(null, { status: 204 }) : json(200, { user }),
    );
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await api.auth.refresh();
    await api.auth.logout();

    expect(callsTo('/v1/auth/refresh')[0]?.body).toEqual({});
    expect(callsTo('/v1/auth/logout')[0]?.body).toEqual({});
    expect(callsTo('/v1/auth/logout')[0]?.init.credentials).toBe('include');
  });
});

describe('transporte mobile', () => {
  it('envía Bearer desde el tokenStore y nunca cookies', async () => {
    const { fetch, calls } = mockFetch(() => json(200, user));
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: spyStore(tokens(1)),
      fetch,
    });

    await api.users.me();

    expect(calls[0]?.headers.authorization).toBe('Bearer access-1');
    expect(calls[0]?.headers['x-client-platform']).toBe('mobile');
    expect(calls[0]?.init.credentials).toBe('omit');
  });

  it('login guarda los tokens y no los expone al llamante', async () => {
    const store = spyStore(null);
    const { fetch, calls } = mockFetch(() => json(200, { user, tokens: tokens(1) }));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    await expect(api.auth.login({ email: user.email, password: 'x' })).resolves.toEqual({ user });

    expect(store.set).toHaveBeenCalledWith(tokens(1));
    // Las rutas de auth son públicas: no se adjunta Authorization.
    expect(calls[0]?.headers).not.toHaveProperty('authorization');
  });

  it('register sin tokens en la respuesta es una respuesta inválida', async () => {
    const store = spyStore(null);
    const { fetch } = mockFetch(() => json(201, { user }));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const error = await api.auth
      .register({ email: user.email, password: 'contraseña-larga' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'invalid_response', status: 201 });
    expect(store.set).not.toHaveBeenCalled();
  });

  it('refresh envía el refresh token en el cuerpo y rota los tokens guardados', async () => {
    const store = spyStore(tokens(1));
    const { fetch, calls } = mockFetch(() => json(200, { user, tokens: tokens(2) }));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    await api.auth.refresh();

    expect(calls[0]?.body).toEqual({ refreshToken: 'refresh-1' });
    expect(store.set).toHaveBeenCalledWith(tokens(2));
  });

  it('refresh sin sesión guardada falla con no_session sin llamar a la API', async () => {
    const { fetch, calls } = mockFetch(() => json(200, {}));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: spyStore(null), fetch });

    await expect(api.auth.refresh()).rejects.toMatchObject({ code: 'no_session', status: 0 });
    expect(calls).toHaveLength(0);
  });
});

describe('renovación de sesión ante 401', () => {
  it('single-flight en mobile: dos 401 simultáneos provocan un solo refresh y ambos se reintentan', async () => {
    const store = spyStore(tokens(1));
    const refreshGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      if (req.url.endsWith('/auth/refresh')) {
        await refreshGate.promise;
        return json(200, { user, tokens: tokens(2) });
      }
      return req.headers.authorization === 'Bearer access-2'
        ? json(200, user)
        : json(401, errorBody(401, 'x'));
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const both = Promise.all([api.users.me(), api.users.me()]);
    // Se espera a que ambas peticiones hayan recibido su 401 antes de dejar terminar el refresh.
    await vi.waitFor(() => expect(callsTo('/v1/users/me')).toHaveLength(2));
    refreshGate.resolve();

    await expect(both).resolves.toEqual([user, user]);
    expect(callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(callsTo('/v1/users/me')).toHaveLength(4);
    expect(store.set).toHaveBeenCalledTimes(1);
  });

  it('single-flight en web: un solo refresh con cookies', async () => {
    let refreshed = false;
    const refreshGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      if (req.url.endsWith('/auth/refresh')) {
        await refreshGate.promise;
        refreshed = true;
        return json(200, { user });
      }
      return refreshed ? json(200, user) : json(401, errorBody(401, 'x'));
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    const both = Promise.all([api.users.me(), api.users.me(), api.auth.refresh()]);
    await vi.waitFor(() => expect(callsTo('/v1/users/me')).toHaveLength(2));
    refreshGate.resolve();

    await expect(both).resolves.toEqual([user, user, { user }]);
    expect(callsTo('/v1/auth/refresh')).toHaveLength(1);
  });

  it('si el refresh es rechazado: limpia el store, avisa una sola vez y lanza el 401 original', async () => {
    const store = spyStore(tokens(1));
    const onSessionExpired = vi.fn();
    const { fetch, callsTo } = mockFetch((req) =>
      req.url.endsWith('/auth/refresh')
        ? json(401, errorBody(401, 'Sesión inválida'))
        : json(401, errorBody(401, 'No autenticado')),
    );
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: store,
      onSessionExpired,
      fetch,
    });

    const results = await Promise.allSettled([api.users.me(), api.users.me()]);

    for (const result of results) {
      expect(result.status).toBe('rejected');
      const reason = (result as PromiseRejectedResult).reason as ApiError;
      expect(reason).toBeInstanceOf(ApiError);
      expect(reason).toMatchObject({ status: 401, code: 'http', message: 'No autenticado' });
      expect(reason.cause).toBeInstanceOf(ApiError);
    }
    expect(callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    await expect(store.get()).resolves.toBeNull();
  });

  it('un fallo de red en el refresh no cierra la sesión', async () => {
    const store = spyStore(tokens(1));
    const onSessionExpired = vi.fn();
    const { fetch } = mockFetch((req) => {
      if (req.url.endsWith('/auth/refresh')) throw new TypeError('Failed to fetch');
      return json(401, errorBody(401, 'x'));
    });
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: store,
      onSessionExpired,
      fetch,
    });

    await expect(api.users.me()).rejects.toMatchObject({ code: 'network', status: 0 });
    expect(store.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('reintenta una sola vez: si tras renovar sigue el 401, lo propaga', async () => {
    const { fetch, callsTo } = mockFetch((req) =>
      req.url.endsWith('/auth/refresh') ? json(200, { user }) : json(401, errorBody(401, 'x')),
    );
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
    expect(callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(callsTo('/v1/users/me')).toHaveLength(2);
  });

  it('las rutas públicas no intentan renovar (login con credenciales inválidas)', async () => {
    const onSessionExpired = vi.fn();
    const { fetch, calls } = mockFetch(() => json(401, errorBody(401, 'Credenciales inválidas')));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', onSessionExpired, fetch });

    await expect(api.auth.login({ email: user.email, password: 'x' })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas',
    });
    expect(calls).toHaveLength(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('un refresh rechazado tras un login posterior no borra la sesión nueva ni avisa', async () => {
    const store = spyStore(tokens(1));
    const onSessionExpired = vi.fn();
    const refreshGate = deferred();
    const { fetch } = mockFetch(async (req) => {
      if (req.url.endsWith('/auth/refresh')) {
        await refreshGate.promise;
        return json(401, errorBody(401, 'Sesión revocada'));
      }
      return json(200, { user, tokens: tokens(2) });
    });
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: store,
      onSessionExpired,
      fetch,
    });

    const refreshing = api.auth.refresh().catch((e: unknown) => e);
    await api.auth.login({ email: user.email, password: 'x' });
    refreshGate.resolve();

    await expect(refreshing).resolves.toMatchObject({ status: 401, code: 'http' });
    await expect(store.get()).resolves.toEqual(tokens(2));
    expect(store.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('no reintenta con la sesión de otra cuenta si hubo login mientras la petición estaba en vuelo', async () => {
    // Usuario A: su sesión caduca, el refresh se rechaza y B inicia sesión antes de que llegue el 401 de A.
    const store = spyStore(tokens(1));
    const transferGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === '/v1/transfer') {
        if (req.headers.authorization === 'Bearer access-1') {
          await transferGate.promise;
          return json(401, errorBody(401, 'Token caducado'));
        }
        return json(200, { ok: true });
      }
      if (path === '/v1/users/me') return json(401, errorBody(401, 'Token caducado'));
      if (path === '/v1/auth/refresh') return json(401, errorBody(401, 'Sesión revocada'));
      return json(200, { user, tokens: tokens(2) });
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const transfer = api
      .request(z.object({ ok: z.boolean() }), '/transfer', { method: 'POST', body: { amount: 100 } })
      .catch((e: unknown) => e);
    await vi.waitFor(() => expect(callsTo('/v1/transfer')).toHaveLength(1));
    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
    await api.auth.login({ email: user.email, password: 'x' });
    transferGate.resolve();

    await expect(transfer).resolves.toMatchObject({ status: 401, code: 'http', message: 'Token caducado' });
    expect(callsTo('/v1/transfer').map((c) => c.headers.authorization)).toEqual(['Bearer access-1']);
    await expect(store.get()).resolves.toEqual(tokens(2));
  });

  it('no reintenta con la sesión de otra cuenta si hubo login mientras esperaba la renovación', async () => {
    const store = spyStore(tokens(1));
    const refreshGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === '/v1/transfer') {
        return req.headers.authorization === 'Bearer access-1'
          ? json(401, errorBody(401, 'Token caducado'))
          : json(200, { ok: true });
      }
      if (path === '/v1/auth/refresh') {
        await refreshGate.promise;
        return json(200, { user, tokens: tokens(3) });
      }
      return json(200, { user, tokens: tokens(2) });
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const transfer = api
      .request(z.object({ ok: z.boolean() }), '/transfer', { method: 'POST', body: { amount: 100 } })
      .catch((e: unknown) => e);
    await vi.waitFor(() => expect(callsTo('/v1/auth/refresh')).toHaveLength(1));
    await api.auth.login({ email: user.email, password: 'x' });
    refreshGate.resolve();

    await expect(transfer).resolves.toMatchObject({ status: 401, code: 'http' });
    expect(callsTo('/v1/transfer').map((c) => c.headers.authorization)).toEqual(['Bearer access-1']);
    // Los tokens renovados de A no sustituyen a la sesión de B.
    await expect(store.get()).resolves.toEqual(tokens(2));
  });

  it('tras un logout no reintenta una petición en vuelo que recibe 401', async () => {
    const store = spyStore(tokens(1));
    const itemsGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === '/v1/items') {
        await itemsGate.promise;
        return json(401, errorBody(401, 'x'));
      }
      return new Response(null, { status: 204 });
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const items = api.request(z.unknown(), '/items').catch((e: unknown) => e);
    await vi.waitFor(() => expect(callsTo('/v1/items')).toHaveLength(1));
    await api.auth.logout();
    itemsGate.resolve();

    await expect(items).resolves.toMatchObject({ status: 401, code: 'http' });
    expect(callsTo('/v1/items')).toHaveLength(1);
    expect(callsTo('/v1/auth/refresh')).toHaveLength(0);
  });

  it('si otra petición ya renovó la sesión del mismo usuario, reintenta sin volver a renovar', async () => {
    const store = spyStore(tokens(1));
    const slowGate = deferred();
    const { fetch, callsTo } = mockFetch(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === '/v1/auth/refresh') return json(200, { user, tokens: tokens(2) });
      if (req.headers.authorization === 'Bearer access-2') return json(200, { ok: true });
      if (path === '/v1/slow') await slowGate.promise;
      return json(401, errorBody(401, 'x'));
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const slow = api.request(z.object({ ok: z.boolean() }), '/slow');
    await vi.waitFor(() => expect(callsTo('/v1/slow')).toHaveLength(1));
    await api.request(z.object({ ok: z.boolean() }), '/fast');
    slowGate.resolve();

    await expect(slow).resolves.toEqual({ ok: true });
    expect(callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(callsTo('/v1/slow').map((c) => c.headers.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('en mobile sin sesión guardada un 401 es definitivo (sin refresh ni aviso)', async () => {
    const onSessionExpired = vi.fn();
    const { fetch, calls } = mockFetch(() => json(401, errorBody(401, 'x')));
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: spyStore(null),
      onSessionExpired,
      fetch,
    });

    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('errores de transporte', () => {
  it('timeout: aborta la petición y lanza ApiError timeout con status 0', async () => {
    let receivedSignal: AbortSignal | undefined;
    const fetch = vi.fn((_input: string, init: RequestInit) => {
      receivedSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'web',
      timeoutMs: 20,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    const error = await api.health().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'timeout', status: 0, isNetworkError: true });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('cancelación por el llamante: ApiError aborted', async () => {
    const fetch = vi.fn(
      (_input: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'web',
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const controller = new AbortController();

    const pending = api.request(z.unknown(), '/items', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'aborted', status: 0 });
  });

  it('red caída: ApiError network con status 0', async () => {
    const { fetch } = mockFetch(() => {
      throw new TypeError('Network request failed');
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.health()).rejects.toMatchObject({ code: 'network', status: 0, isNetworkError: true });
  });

  it('error HTTP: expone status y el ApiErrorResponse', async () => {
    const body = errorBody(409, 'No se ha podido completar el registro');
    const { fetch } = mockFetch(() => json(409, body));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    const error = await api.auth
      .register({ email: user.email, password: 'contraseña-larga' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'http', body, message: body.message });
  });

  it('error HTTP con cuerpo fuera de contrato: body null', async () => {
    const { fetch } = mockFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.health()).rejects.toMatchObject({ status: 502, code: 'http', body: null });
  });
});

describe('validación de respuestas', () => {
  it('rechaza una respuesta que no cumple el contrato', async () => {
    const { fetch } = mockFetch(() => json(200, { id: 'no-es-uuid', email: 'x' }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    const error = await api.users.me().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'invalid_response', status: 200 });
    expect((error as ApiError).cause).toBeInstanceOf(z.ZodError);
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { fetch } = mockFetch(() => new Response('ok', { status: 200 }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.health()).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('logout', () => {
  it('limpia el store aunque falle la red, y relanza el error', async () => {
    const store = spyStore(tokens(1));
    const { fetch, calls } = mockFetch(() => {
      throw new TypeError('Network request failed');
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    await expect(api.auth.logout()).rejects.toMatchObject({ code: 'network' });

    expect(calls[0]?.body).toEqual({ refreshToken: 'refresh-1' });
    expect(calls[0]?.headers).not.toHaveProperty('authorization');
    expect(store.clear).toHaveBeenCalledTimes(1);
    await expect(store.get()).resolves.toBeNull();
  });

  it('en mobile sin sesión guardada no llama a la API', async () => {
    const store = spyStore(null);
    const { fetch, calls } = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    await expect(api.auth.logout()).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('un refresh en curso no vuelve a guardar tokens después del logout', async () => {
    const store = spyStore(tokens(1));
    const refreshGate = deferred();
    const { fetch } = mockFetch(async (req) => {
      if (req.url.endsWith('/auth/refresh')) {
        await refreshGate.promise;
        return json(200, { user, tokens: tokens(2) });
      }
      return new Response(null, { status: 204 });
    });
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    const refreshing = api.auth.refresh();
    const loggingOut = api.auth.logout();
    refreshGate.resolve();
    await Promise.all([refreshing, loggingOut]);

    await expect(store.get()).resolves.toBeNull();
  });
});

describe('request', () => {
  it('prefija la versión, serializa el cuerpo y valida con el esquema dado', async () => {
    const { fetch, calls } = mockFetch(() => json(201, { id: 7 }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', version: 'v2', fetch });

    const result = await api.request(z.object({ id: z.number() }), '/items?draft=1', {
      method: 'POST',
      body: { name: 'a' },
    });

    expect(result).toEqual({ id: 7 });
    expect(calls[0]?.url).toBe(`${BASE}/v2/items?draft=1`);
    expect(calls[0]?.body).toEqual({ name: 'a' });
  });

  it.each(['https://evil.example/steal', '//evil.example', 'items', '/a/../health', '/a\\b', '/a#b'])(
    'rechaza rutas que no son relativas a la API: %s',
    async (path) => {
      const { fetch, calls } = mockFetch(() => json(200, {}));
      const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

      await expect(api.request(z.unknown(), path)).rejects.toThrow(/Ruta inválida/);
      expect(calls).toHaveLength(0);
    },
  );

  it('no permite sobrescribir cabeceras gestionadas por el cliente', async () => {
    const { fetch, calls } = mockFetch(() => json(200, {}));
    const api = createApiClient({
      baseUrl: BASE,
      platform: 'mobile',
      tokenStore: spyStore(tokens(1)),
      fetch,
    });

    await api.request(z.unknown(), '/items', {
      headers: { Authorization: 'Bearer robado', 'X-Client-Platform': 'web', Cookie: 'a=b', 'x-trace': '1' },
    });

    expect(calls[0]?.headers).toEqual({
      accept: 'application/json',
      'x-trace': '1',
      'x-client-platform': 'mobile',
      authorization: 'Bearer access-1',
    });
  });

  it('auth: false no adjunta Authorization ni renueva ante 401', async () => {
    const store = spyStore(tokens(1));
    const { fetch, calls } = mockFetch(() => json(401, errorBody(401, 'x')));
    const api = createApiClient({ baseUrl: BASE, platform: 'mobile', tokenStore: store, fetch });

    await expect(api.request(z.unknown(), '/public', { auth: false })).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers).not.toHaveProperty('authorization');
  });

  it('acepta 204 sin cuerpo con un esquema que lo admita', async () => {
    const { fetch } = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: BASE, platform: 'web', fetch });

    await expect(api.request(z.undefined(), '/items/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
