import type { ApiErrorResponse } from '@rulet/shared';

/**
 * Motivo del fallo:
 * - `http`: la API respondió con un estado de error (4xx/5xx). `body` trae el `ApiErrorResponse` si es válido.
 * - `network`: no hubo respuesta (sin conexión, DNS, TLS, CORS…). `status` es `0`.
 * - `timeout`: la API no respondió dentro de `timeoutMs`. `status` es `0`.
 * - `aborted`: el llamante canceló la petición con su `AbortSignal`. `status` es `0`.
 * - `invalid_response`: la respuesta no cumple el contrato de `@rulet/shared`. Es un fallo de integración, no del usuario.
 * - `no_session`: se pidió una operación que necesita sesión y no hay ninguna guardada. `status` es `0`.
 */
export type ApiErrorCode = 'http' | 'network' | 'timeout' | 'aborted' | 'invalid_response' | 'no_session';

export interface ApiErrorOptions {
  code?: ApiErrorCode;
  message?: string;
  cause?: unknown;
}

/**
 * Error tipado de cualquier fallo al hablar con la API (HTTP, red, timeout, contrato).
 * Los errores de uso del cliente (configuración o ruta inválidas) son `Error` normales: son fallos de programación.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(
    /** Estado HTTP de la respuesta, o `0` si no llegó a haber respuesta. */
    readonly status: number,
    readonly body: ApiErrorResponse | null,
    options: ApiErrorOptions = {},
  ) {
    super(options.message ?? body?.message ?? `La API respondió ${status}`, { cause: options.cause });
    this.name = 'ApiError';
    this.code = options.code ?? 'http';
  }

  /** `true` si el fallo es de conectividad (red caída o timeout): tiene sentido reintentar más tarde. */
  get isNetworkError(): boolean {
    return this.code === 'network' || this.code === 'timeout';
  }

  /** `true` si la API ha rechazado la identidad del usuario (no hay sesión válida). */
  get isUnauthorized(): boolean {
    return (this.code === 'http' && this.status === 401) || this.code === 'no_session';
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
