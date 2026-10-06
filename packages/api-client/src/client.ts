import { ApiErrorResponseSchema, CLIENT_PLATFORM_HEADER, HealthResponseSchema } from '@rulet/shared';
import type { Platform } from '@rulet/shared';
import type { z } from 'zod';
import { ApiError } from './errors';

export interface ApiClientOptions {
  /** Origen de la API, sin versión. P. ej. `https://api.rulet.app`. */
  baseUrl: string;
  /** Versión de la API a la que se dirigen las rutas versionadas. */
  version?: `v${number}`;
  platform: Platform;
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
}

/** Cliente HTTP que comparten web y móvil. Valida cada respuesta contra su contrato de @rulet/shared. */
export function createApiClient({
  baseUrl,
  version = 'v1',
  platform,
  getToken,
  fetch: fetchImpl = fetch,
}: ApiClientOptions) {
  /** Llama a una ruta versionada (`/v1/...`). */
  function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit) {
    return send(schema, `/${version}${path}`, init);
  }

  async function send<S extends z.ZodType>(
    schema: S,
    path: string,
    init: RequestInit = {},
  ): Promise<z.infer<S>> {
    const token = await getToken?.();
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        [CLIENT_PLATFORM_HEADER]: platform,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = ApiErrorResponseSchema.safeParse(body);
      throw new ApiError(res.status, parsed.success ? parsed.data : null);
    }
    return schema.parse(body);
  }

  return {
    request,
    /** Endpoint operativo, fuera del versionado. */
    health: () => send(HealthResponseSchema, '/health'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
