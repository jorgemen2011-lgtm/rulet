import { isApiError } from '@rulet/api-client';

const MESSAGES = {
  network: 'No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.',
  sessionExpired: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  forbidden: 'No tienes permiso para ver este contenido.',
  rateLimited: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
  unavailable: 'El servicio no está disponible en este momento. Inténtalo más tarde.',
  unexpected: 'Ha ocurrido un error. Inténtalo de nuevo.',
} as const;

/**
 * Traduce un fallo de la API a un mensaje para el usuario. Los mensajes son fijos a propósito: nunca se muestra
 * el texto del servidor ni detalles internos.
 */
export function {{nameCamel}}ErrorMessage(error: unknown): string {
  if (!isApiError(error)) return MESSAGES.unexpected;
  if (error.isNetworkError) return MESSAGES.network;
  if (error.isUnauthorized) return MESSAGES.sessionExpired;
  if (error.code !== 'http') return MESSAGES.unexpected;
  if (error.status === 403) return MESSAGES.forbidden;
  if (error.status === 429) return MESSAGES.rateLimited;
  if (error.status >= 500) return MESSAGES.unavailable;
  return MESSAGES.unexpected;
}
