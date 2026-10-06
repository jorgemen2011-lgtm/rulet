import { isApiError } from '@rulet/api-client';

export type AuthOperation = 'login' | 'register' | 'logout' | 'session';

const GENERIC = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';

/**
 * Traduce un fallo de la API a un mensaje para el usuario. Nunca se muestra el texto que envía el servidor
 * ni detalles internos: los mensajes son fijos y genéricos para no filtrar información (p. ej. si un email
 * está registrado) ni depender de la redacción de la API.
 */
export function authErrorMessage(error: unknown, operation: AuthOperation): string {
  if (!isApiError(error)) return GENERIC;
  if (error.isNetworkError) return 'No se ha podido conectar con el servidor. Comprueba tu conexión.';
  if (error.code !== 'http') return GENERIC;

  if (error.status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.';
  if (error.status >= 500) return 'El servicio no está disponible en este momento. Inténtalo más tarde.';

  switch (operation) {
    case 'login':
      if (error.status === 401) return 'Email o contraseña incorrectos.';
      break;
    case 'register':
      if (error.status === 409) return 'No se ha podido completar el registro.';
      break;
    case 'logout':
      return 'No se ha podido cerrar la sesión. Inténtalo de nuevo.';
    case 'session':
      break;
  }
  if (error.status === 400) return 'Revisa los datos e inténtalo de nuevo.';
  return GENERIC;
}
