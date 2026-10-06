import type { HealthResponse, Platform } from '@rulet/shared';

export interface ApiClientOptions {
  baseUrl: string;
  platform: Platform;
  getToken?: () => string | null | Promise<string | null>;
}

/** Cliente HTTP tipado que comparten web y mobile para hablar con la API. */
export function createApiClient({ baseUrl, platform, getToken }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken?.();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': platform,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    request,
    health: () => request<HealthResponse>('/health'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
