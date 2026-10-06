'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { useAuth } from './use-auth';

/**
 * En /login y /register: si ya hay sesión (o se acaba de iniciar), navega a `redirectTo`.
 * `redirectTo` debe venir ya validado con `safeRedirectPath` (solo rutas internas). Aun así se vuelve a validar
 * justo antes de navegar: `router.replace` acepta URLs de otro origen y este es el único punto que las ejecuta.
 */
export function useRedirectIfAuthenticated(redirectTo: string): void {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(safeRedirectPath(redirectTo));
  }, [state.status, redirectTo, router]);
}
