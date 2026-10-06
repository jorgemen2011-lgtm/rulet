import { ApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  credentials: RequestCredentials;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  /** Cuerpo ya decodificado: `undefined` si venía vacío. */
  body: unknown;
  /** `true` si el cuerpo no era JSON válido. */
  malformed: boolean;
}

/**
 * Ejecuta una petición con timeout. El timeout cubre también la lectura del cuerpo:
 * un servidor que envía cabeceras y luego se cuelga no bloquea la app indefinidamente.
 * Todos los fallos sin respuesta se traducen a `ApiError` con `status` 0.
 */
export async function sendHttp(fetchImpl: FetchFn, req: HttpRequest): Promise<HttpResponse> {
  const { signal } = req;
  if (signal?.aborted) {
    throw new ApiError(0, null, { code: 'aborted', message: 'Petición cancelada', cause: signal.reason });
  }

  // Se combina a mano la señal del llamante con la del timeout: `AbortSignal.any` no existe en todos los runtimes (Hermes).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, req.timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const res = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      credentials: req.credentials,
      // La API nunca redirige: seguir una redirección podría llevar credenciales a otro destino.
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await res.text();
    const decoded = decodeJson(text);
    return { status: res.status, ok: res.ok, ...decoded };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) {
      throw new ApiError(0, null, {
        code: 'timeout',
        message: `La API no respondió en ${req.timeoutMs} ms`,
        cause: error,
      });
    }
    if (signal?.aborted) {
      throw new ApiError(0, null, { code: 'aborted', message: 'Petición cancelada', cause: error });
    }
    throw new ApiError(0, null, { code: 'network', message: 'No se pudo conectar con la API', cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function decodeJson(text: string): { body: unknown; malformed: boolean } {
  if (text.trim() === '') return { body: undefined, malformed: false };
  try {
    return { body: JSON.parse(text) as unknown, malformed: false };
  } catch {
    return { body: undefined, malformed: true };
  }
}
