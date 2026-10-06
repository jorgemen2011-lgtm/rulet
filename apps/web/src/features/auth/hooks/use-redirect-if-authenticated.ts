'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './use-auth';

/**
 * En /login y /register: si ya hay sesión (o se acaba de iniciar), navega a `redirectTo`.
 * `redirectTo` debe venir ya validado con `safeRedirectPath` (solo rutas internas).
 */
export function useRedirectIfAuthenticated(redirectTo: string): void {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(redirectTo);
  }, [state.status, redirectTo, router]);
}
