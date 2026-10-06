import type { ApiErrorResponse } from '@rulet/shared';

/** Error tipado que lanzan todas las llamadas del cliente cuando la API responde con un fallo. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorResponse | null,
  ) {
    super(body?.message ?? `API respondió ${status}`);
    this.name = 'ApiError';
  }
}
