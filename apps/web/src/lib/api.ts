import { createApiClient } from '@rulet/api-client';
import { env } from './env';

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Cliente de la API para el NAVEGADOR. En web la sesión vive en cookies httpOnly del host de la API: el
 * JavaScript de la página nunca ve los tokens (ni en memoria, ni en localStorage, ni en sessionStorage).
 *
 * No lo uses desde Server Components ni desde `proxy.ts`: allí no viajan las cookies del usuario (pertenecen
 * al host de la API, no al de la web), así que todas las llamadas autenticadas fallarían con 401.
 */
export const api = createApiClient({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  platform: 'web',
  onSessionExpired: () => {
    for (const listener of sessionExpiredListeners) listener();
  },
});

/**
 * Se suscribe al aviso de sesión caducada (la API ha rechazado la renovación). El cliente es un singleton de
 * módulo, así que el aviso se reparte por aquí en vez de fijar un único callback al crearlo.
 * Devuelve la función para cancelar la suscripción (encaja con el cleanup de `useEffect`).
 */
export function subscribeSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}
