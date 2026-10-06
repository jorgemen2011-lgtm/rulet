import { createApiClient } from '@rulet/api-client';
import { env } from './env';
import { secureTokenStore } from './secure-token-store';

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Suscribe a la expiración de la sesión (la API ha rechazado la renovación). Devuelve la función para
 * cancelar la suscripción. El cliente se crea a nivel de módulo, así que el AuthProvider se entera por aquí.
 */
export function subscribeToSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** Cliente de la API para móvil: Bearer token desde el almacén seguro, sin cookies. */
export const api = createApiClient({
  platform: 'mobile',
  baseUrl: env.apiUrl,
  allowInsecureHttp: env.allowInsecureHttp,
  tokenStore: secureTokenStore,
  onSessionExpired: () => {
    for (const listener of [...sessionExpiredListeners]) listener();
  },
});
