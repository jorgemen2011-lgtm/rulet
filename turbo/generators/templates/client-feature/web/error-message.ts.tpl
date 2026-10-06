import { isApiError } from '@rulet/api-client';

const GENERIC = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';

/**
 * Traduce un fallo de la API a un mensaje para el usuario. Nunca se muestra el texto que envía el servidor:
 * los mensajes son fijos para no filtrar detalles internos ni depender de la redacción de la API.
 */
export function {{nameCamel}}ErrorMessage(error: unknown): string {
  if (!isApiError(error)) return GENERIC;
  if (error.isNetworkError) return 'No se ha podido conectar con el servidor. Comprueba tu conexión.';
  if (error.isUnauthorized) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
  if (error.code !== 'http') return GENERIC;
  if (error.status === 403) return 'No tienes permiso para ver este contenido.';
  if (error.status === 429) return 'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.';
  if (error.status >= 500) return 'El servicio no está disponible en este momento. Inténtalo más tarde.';
  return GENERIC;
}
