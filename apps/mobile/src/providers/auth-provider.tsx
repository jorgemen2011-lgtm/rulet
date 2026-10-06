import { isApiError } from '@rulet/api-client';
import type { LoginRequest, RegisterRequest, User } from '@rulet/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, subscribeToSessionExpired } from '../lib/api';
import { clearSessionOnFirstLaunch } from '../lib/first-launch';
import { installMarker } from '../lib/install-marker';
import { secureTokenStore } from '../lib/secure-token-store';

/**
 * Estado de la sesión:
 * - `loading`: aún no se sabe si hay sesión. `connectionError` indica que no se pudo validar contra la API
 *   por un fallo transitorio (sin red, 5xx…); los tokens se conservan y se puede reintentar.
 * - `authenticated`: sesión validada con `users.me`.
 * - `anonymous`: no hay sesión o la API la ha rechazado.
 */
export type SessionState =
  | { status: 'loading'; connectionError: boolean }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous' };

export interface SessionContextValue {
  state: SessionState;
  login(body: LoginRequest): Promise<void>;
  register(body: RegisterRequest): Promise<void>;
  /** Cierra la sesión. Nunca falla: el almacén local se limpia aunque la API no responda. */
  logout(): Promise<void>;
  /** Reintenta validar la sesión guardada tras un error de conexión. */
  retry(): void;
}

const ANONYMOUS: SessionState = { status: 'anonymous' };

const SessionContext = createContext<SessionContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', connectionError: false });
  // Cada valor distinto lanza una validación de la sesión guardada (arranque y reintentos).
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => subscribeToSessionExpired(() => setState(ANONYMOUS)), []);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempt]);

  const login = useCallback(async (body: LoginRequest) => {
    const { user } = await api.auth.login(body);
    setState({ status: 'authenticated', user });
  }, []);

  const register = useCallback(async (body: RegisterRequest) => {
    const { user } = await api.auth.register(body);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // El cliente ya ha borrado los tokens del dispositivo; si la API no ha podido revocar la sesión,
      // esta caduca sola y nadie conserva el refresh token. No tiene sentido retener al usuario.
    } finally {
      setState(ANONYMOUS);
    }
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'loading', connectionError: false });
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ state, login, register, logout, retry }),
    [state, login, register, logout, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Acceso al estado de sesión. Solo dentro de `AuthProvider`. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <AuthProvider>.');
  return value;
}

/** Lee la sesión guardada y la valida contra la API. Nunca lanza: traduce cada fallo a un estado. */
async function restoreSession(): Promise<SessionState> {
  try {
    // Una reinstalación no hereda la sesión anterior (en iOS el Keychain sobrevive a la desinstalación).
    // Si la limpieza falla se cae al catch: sin sesión, nunca con la heredada.
    await clearSessionOnFirstLaunch({ marker: installMarker, tokenStore: secureTokenStore });
    // Sin tokens no hay nada que validar: se evita una llamada a la API que fallaría sin conexión.
    if (!(await secureTokenStore.get())) return ANONYMOUS;
    const user = await api.users.me();
    return { status: 'authenticated', user };
  } catch (error) {
    // Un fallo transitorio no significa que la sesión sea inválida: se conservan los tokens y se ofrece reintentar.
    if (isTransientError(error)) return { status: 'loading', connectionError: true };
    // 401 tras intentar renovar (el cliente ya ha limpiado el almacén), respuesta fuera de contrato,
    // almacén ilegible o marca de instalación inaccesible: se trata como sin sesión y el usuario vuelve a
    // autenticarse.
    return ANONYMOUS;
  }
}

function isTransientError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.isNetworkError || (error.code === 'http' && (error.status === 429 || error.status >= 500));
}
