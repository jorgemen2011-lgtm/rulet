import { isApiError } from '@rulet/api-client';

export type AuthAction = 'login' | 'register';

const MESSAGES = {
  network: 'No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.',
  rateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  invalidCredentials: 'Email o contraseña incorrectos.',
  registerFailed: 'No se ha podido completar el registro.',
  unexpected: 'Ha ocurrido un error. Inténtalo de nuevo.',
} as const;

/**
 * Traduce un fallo de login/registro a un mensaje para el usuario.
 * Los mensajes son genéricos a propósito: nunca se muestra el texto del servidor ni se revela si un email
 * está registrado (en el registro, un 409 y un 400 se presentan igual).
 */
export function authErrorMessage(error: unknown, action: AuthAction): string {
  if (!isApiError(error)) return MESSAGES.unexpected;
  if (error.isNetworkError) return MESSAGES.network;
  if (error.code !== 'http') return MESSAGES.unexpected;
  if (error.status === 429) return MESSAGES.rateLimited;
  if (action === 'login' && error.status === 401) return MESSAGES.invalidCredentials;
  if (action === 'register' && (error.status === 400 || error.status === 409)) return MESSAGES.registerFailed;
  return MESSAGES.unexpected;
}
