'use client';

import { useContext } from 'react';
import { AuthContext } from '../auth-context';
import type { AuthContextValue } from '../auth-context';

/** Sesión actual y acciones de autenticación. Requiere `<AuthProvider>` (está en el layout raíz). */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return value;
}
