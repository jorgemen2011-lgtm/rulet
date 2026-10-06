import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';

export { AuthProvider, useSession } from './auth-provider';
export type { SessionContextValue, SessionState } from './auth-provider';

/** Providers globales de la app, en el orden en que dependen unos de otros. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
