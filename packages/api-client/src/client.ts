import {
  ApiErrorResponseSchema,
  AuthResponseSchema,
  AuthTokensSchema,
  CLIENT_PLATFORM_HEADER,
  HealthResponseSchema,
  UserSchema,
  isPlatform,
} from '@rulet/shared';
import type { AuthResponse, HealthResponse, LoginRequest, RegisterRequest, User } from '@rulet/shared';
import { z } from 'zod';
import { ApiError } from './errors';
import { sendHttp } from './http';
import type { FetchFn, HttpMethod, HttpResponse } from './http';
import type { TokenStore } from './token-store';
import { assertSafePath, resolveBaseUrl } from './url';

export const DEFAULT_TIMEOUT_MS = 15_000;

interface BaseApiClientOptions {
  /** Origen de la API, sin versión. P. ej. `https://api.rulet.app`. */
  baseUrl: string;
  /** Versión de la API a la que se dirigen las rutas versionadas. Por defecto `v1`. */
  version?: `v${number}`;
  /** Tiempo máximo por intento (incluida la lectura del cuerpo). Por defecto 15 000 ms. */
  timeoutMs?: number;
  /** Permite `http://` hacia hosts no locales. Solo para entornos controlados; nunca en producción. */
  allowInsecureHttp?: boolean;
  /** Se invoca una vez cuando la API rechaza la renovación de la sesión (el usuario debe volver a autenticarse). */
  onSessionExpired?: () => void;
  /** Implementación de `fetch`. Por defecto, la global. */
  fetch?: typeof fetch;
}

export interface WebApiClientOptions extends BaseApiClientOptions {
  platform: 'web';
  /** Se ignora en web: la sesión vive en cookies httpOnly. */
  tokenStore?: TokenStore;
}

export interface MobileApiClientOptions extends BaseApiClientOptions {
  platform: 'mobile';
  /** Obligatorio en móvil: almacén seguro donde se guardan access y refresh token. */
  tokenStore: TokenStore;
}

export type ApiClientOptions = WebApiClientOptions | MobileApiClientOptions;

export interface RequestOptions {
  method?: HttpMethod;
  /** Se serializa como JSON. */
  body?: unknown;
  /** Cabeceras adicionales. `authorization`, `cookie` y `x-client-platform` las gestiona el cliente y se ignoran. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Sustituye a `timeoutMs` del cliente para esta petición. */
  timeoutMs?: number;
  /**
   * `true` (por defecto): ruta autenticada; envía credenciales y, ante un 401, renueva la sesión y reintenta una vez.
   * `false`: ruta pública; ni adjunta `Authorization` ni intenta renovar.
   */
  auth?: boolean;
}

/** Resultado de register/login/refresh. Los tokens nunca se devuelven: los gestiona el cliente. */
export interface AuthResult {
  user: User;
}

export interface ApiClient {
  auth: {
    register(body: RegisterRequest): Promise<AuthResult>;
    login(body: LoginRequest): Promise<AuthResult>;
    /** Renueva la sesión. Comparte la renovación en curso si ya hay una (single-flight). */
    refresh(): Promise<AuthResult>;
    /** Revoca la sesión en la API y limpia el almacén local aunque la petición falle; si falla, relanza el error. */
    logout(): Promise<void>;
  };
  users: {
    me(): Promise<User>;
  };
  /** `GET /health`: liveness, fuera del versionado. */
  health(): Promise<HealthResponse>;
  /** Llama a una ruta versionada (`/v1${path}`) y valida la respuesta con `schema`. */
  request<S extends z.ZodType>(schema: S, path: string, options?: RequestOptions): Promise<z.output<S>>;
}

interface Call {
  method: HttpMethod;
  /** Ruta absoluta respecto a `baseUrl`, ya con la versión si procede. */
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth: boolean;
}

/** Cabeceras que controla el cliente: el llamante no puede sobrescribirlas ni duplicarlas con otra capitalización. */
const RESERVED_HEADERS = new Set(['authorization', 'cookie', CLIENT_PLATFORM_HEADER]);

/** En móvil los tokens son obligatorios en el cuerpo: sin ellos la respuesta incumple el contrato. */
const MobileAuthResponseSchema = AuthResponseSchema.extend({ tokens: AuthTokensSchema });

/** Respuesta de logout (`204`) u otra cuyo cuerpo no interesa. */
const IgnoredBodySchema = z.unknown();

/** Cliente HTTP que comparten web y móvil. Valida cada respuesta contra su contrato de @rulet/shared. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { platform, version = 'v1', timeoutMs = DEFAULT_TIMEOUT_MS, onSessionExpired } = options;

  // Validación de configuración: un error aquí es de programación, así que se lanza al construir y no en cada llamada.
  if (!isPlatform(platform)) {
    throw new Error(`platform inválida: "${String(platform)}".`);
  }
  if (!/^v\d+$/.test(version)) {
    throw new Error(`version inválida: "${version}".`);
  }
  assertValidTimeout(timeoutMs);
  const baseUrl = resolveBaseUrl(options.baseUrl, options.allowInsecureHttp ?? false);
  const tokenStore = platform === 'mobile' ? options.tokenStore : null;
  if (platform === 'mobile' && !tokenStore) {
    throw new Error('tokenStore es obligatorio en mobile.');
  }
  // Envoltorio en vez de referencia directa: `fetch` del navegador lanza "Illegal invocation" si se llama con otro `this`.
  const fetchImpl: FetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const credentials: RequestCredentials = platform === 'web' ? 'include' : 'omit';
  const authResponseSchema = tokenStore ? MobileAuthResponseSchema : AuthResponseSchema;

  /**
   * Se incrementa cada vez que cambia la sesión (login, register, refresh, logout). Permite saber si un 401
   * corresponde a credenciales ya sustituidas, en cuyo caso basta con reintentar sin volver a renovar.
   */
  let sessionGeneration = 0;
  let refreshInFlight: Promise<AuthResult> | null = null;

  const versioned = (path: string) => {
    assertSafePath(path);
    return `/${version}${path}`;
  };

  async function attempt(call: Call): Promise<HttpResponse> {
    const headers: Record<string, string> = { accept: 'application/json' };
    for (const [name, value] of Object.entries(call.headers ?? {})) {
      if (!RESERVED_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    headers[CLIENT_PLATFORM_HEADER] = platform;
    if (call.body !== undefined) headers['content-type'] = 'application/json';
    if (call.auth && tokenStore) {
      const tokens = await tokenStore.get();
      if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
    }
    return sendHttp(fetchImpl, {
      method: call.method,
      url: `${baseUrl}${call.path}`,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      credentials,
      timeoutMs: call.timeoutMs ?? timeoutMs,
      signal: call.signal,
    });
  }

  async function execute<S extends z.ZodType>(schema: S, call: Call): Promise<z.output<S>> {
    const generation = sessionGeneration;
    let res = await attempt(call);

    if (res.status === 401 && call.auth) {
      if (generation === sessionGeneration) {
        // En móvil sin tokens no hay nada que renovar: el 401 es definitivo.
        if (tokenStore && !(await tokenStore.get())) throw toHttpError(res);
        try {
          await refreshSession();
        } catch (error) {
          // Si la API rechazó la renovación, el error relevante para el llamante es su propio 401.
          if (isSessionRejection(error)) throw toHttpError(res, error);
          throw error;
        }
      }
      // Un único reintento: si vuelve a fallar se propaga, sin bucles de renovación.
      res = await attempt(call);
    }
    return parseResponse(schema, res);
  }

  /** Single-flight: todas las peticiones que reciben 401 a la vez esperan la misma renovación. */
  function refreshSession(): Promise<AuthResult> {
    // Imprescindible además por la rotación con detección de reutilización: dos refresh simultáneos con
    // el mismo token harían que la API revocase toda la familia de sesiones.
    refreshInFlight ??= performRefresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function performRefresh(): Promise<AuthResult> {
    const generation = sessionGeneration;
    let body: { refreshToken?: string } = {};
    if (tokenStore) {
      const tokens = await tokenStore.get();
      if (!tokens) throw new ApiError(0, null, { code: 'no_session', message: 'No hay sesión que renovar' });
      body = { refreshToken: tokens.refreshToken };
    }
    try {
      const data = await execute(authResponseSchema, {
        method: 'POST',
        path: versioned('/auth/refresh'),
        body,
        auth: false,
      });
      // Si mientras tanto hubo logout o un login nuevo, esos tokens ya no son la sesión vigente.
      if (generation === sessionGeneration) await persistSession(data);
      return { user: data.user };
    } catch (error) {
      if (isSessionRejection(error)) await expireSession();
      throw error;
    }
  }

  async function persistSession(data: AuthResponse): Promise<void> {
    sessionGeneration++;
    // En web los tokens viajan en cookies httpOnly; si la API los incluyese en el cuerpo se descartan.
    // `authResponseSchema` ya garantiza que en móvil vienen tokens.
    if (tokenStore && data.tokens) await tokenStore.set(data.tokens);
  }

  async function expireSession(): Promise<void> {
    try {
      await tokenStore?.clear();
    } finally {
      notifySessionExpired();
    }
  }

  function notifySessionExpired(): void {
    try {
      onSessionExpired?.();
    } catch (error) {
      // Un fallo del callback de la app no debe ocultar el ApiError que recibe el llamante.
      console.error('[api-client] onSessionExpired lanzó un error', error);
    }
  }

  async function authenticate(path: '/auth/login' | '/auth/register', body: unknown): Promise<AuthResult> {
    const data = await execute(authResponseSchema, {
      method: 'POST',
      path: versioned(path),
      body,
      auth: false,
    });
    await persistSession(data);
    return { user: data.user };
  }

  async function logout(): Promise<void> {
    // Se deja terminar una renovación en curso para revocar el token vigente y no uno ya rotado.
    await refreshInFlight?.catch(() => undefined);
    sessionGeneration++;
    try {
      let body: { refreshToken?: string } = {};
      if (tokenStore) {
        const tokens = await tokenStore.get();
        // Sin refresh token en el dispositivo no hay nada que revocar en la API.
        if (!tokens) return;
        body = { refreshToken: tokens.refreshToken };
      }
      await execute(IgnoredBodySchema, {
        method: 'POST',
        path: versioned('/auth/logout'),
        body,
        auth: false,
      });
    } finally {
      await tokenStore?.clear();
    }
  }

  return {
    auth: {
      register: (body) => authenticate('/auth/register', body),
      login: (body) => authenticate('/auth/login', body),
      refresh: refreshSession,
      logout,
    },
    users: {
      me: () => execute(UserSchema, { method: 'GET', path: versioned('/users/me'), auth: true }),
    },
    health: () => execute(HealthResponseSchema, { method: 'GET', path: '/health', auth: false }),
    // `async`: los errores de uso (ruta o timeout inválidos) llegan como rechazo, igual que el resto.
    request: async (schema, path, { method = 'GET', auth = true, timeoutMs: callTimeout, ...rest } = {}) => {
      if (callTimeout !== undefined) assertValidTimeout(callTimeout);
      return execute(schema, { ...rest, method, auth, timeoutMs: callTimeout, path: versioned(path) });
    },
  };
}

function parseResponse<S extends z.ZodType>(schema: S, res: HttpResponse): z.output<S> {
  if (!res.ok) throw toHttpError(res);
  if (res.malformed) {
    throw new ApiError(res.status, null, {
      code: 'invalid_response',
      message: 'La API devolvió un cuerpo no JSON',
    });
  }
  const parsed = schema.safeParse(res.body);
  if (!parsed.success) {
    throw new ApiError(res.status, null, {
      code: 'invalid_response',
      message: 'La respuesta de la API no cumple el contrato',
      cause: parsed.error,
    });
  }
  return parsed.data;
}

function toHttpError(res: HttpResponse, cause?: unknown): ApiError {
  const parsed = ApiErrorResponseSchema.safeParse(res.body);
  return new ApiError(res.status, parsed.success ? parsed.data : null, { code: 'http', cause });
}

/** La API ha dicho explícitamente que la sesión no es válida. Los fallos transitorios (red, 5xx, 429) no cuentan. */
function isSessionRejection(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'http' && (error.status === 401 || error.status === 403);
}

function assertValidTimeout(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`timeoutMs inválido: ${value}. Debe ser un número positivo.`);
  }
}
