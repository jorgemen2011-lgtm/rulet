'use client';

import { isApiError } from '@rulet/api-client';
import type { LoginRequest, RegisterRequest } from '@rulet/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, subscribeSessionExpired } from '@/lib/api';
import { buildLoginHref } from '@/lib/safe-redirect';
import { AuthContext } from '../auth-context';
import type { AuthContextValue, AuthState } from '../auth-context';

const UNAUTHENTICATED: AuthState = { status: 'unauthenticated', user: null };

/**
 * Mantiene el estado de sesión del navegador. Los tokens nunca pasan por aquí: viajan en cookies httpOnly
 * entre el navegador y la API, y este componente solo conoce el `User` que devuelve la API.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // Cada operación que cambia la sesión incrementa la versión. Así, una respuesta que llega tarde (p. ej. el
  // `users.me` inicial resolviendo después de un login) no pisa un estado más reciente.
  const versionRef = useRef(0);
  // Para el aviso de sesión caducada, que llega fuera del ciclo de render.
  const statusRef = useRef(state.status);
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const reload = useCallback(async () => {
    const version = ++versionRef.current;
    let next: AuthState;
    try {
      next = { status: 'authenticated', user: await api.users.me() };
    } catch (error) {
      // Solo un 401 significa "no hay sesión"; un fallo de red no debe echar al usuario.
      next = isApiError(error) && error.isUnauthorized ? UNAUTHENTICATED : { status: 'error', user: null };
    }
    if (version === versionRef.current) setState(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(
    () =>
      subscribeSessionExpired(() => {
        const wasAuthenticated = statusRef.current === 'authenticated';
        versionRef.current++;
        setState(UNAUTHENTICATED);
        // Solo se redirige si había una sesión que se ha perdido. Sin sesión previa (visitante anónimo, o la
        // comprobación inicial), el 401 es lo esperado y no debe sacarle de la página en la que está.
        if (wasAuthenticated) {
          router.replace(buildLoginHref(`${window.location.pathname}${window.location.search}`));
        }
      }),
    [router],
  );

  const login = useCallback(async (input: LoginRequest) => {
    const version = ++versionRef.current;
    const { user } = await api.auth.login(input);
    if (version === versionRef.current) setState({ status: 'authenticated', user });
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    const version = ++versionRef.current;
    const { user } = await api.auth.register(input);
    if (version === versionRef.current) setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    const version = ++versionRef.current;
    await api.auth.logout();
    if (version === versionRef.current) setState(UNAUTHENTICATED);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout, reload }),
    [state, login, register, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
