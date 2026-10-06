import { createContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '@rulet/shared';

/**
 * Estado de la sesión en el navegador. Es solo un reflejo para la UI: quien decide si una petición está
 * autorizada es siempre la API, con las cookies httpOnly que este código no puede leer.
 * - `loading`: comprobando la sesión con `GET /v1/users/me`.
 * - `error`: no se ha podido comprobar (red, API caída). No implica que no haya sesión.
 */
export type AuthState =
  { status: 'authenticated'; user: User } | { status: 'loading' | 'unauthenticated' | 'error'; user: null };

export type AuthStatus = AuthState['status'];

export interface AuthContextValue {
  state: AuthState;
  login(input: LoginRequest): Promise<void>;
  register(input: RegisterRequest): Promise<void>;
  /** Cierra la sesión en la API. Si falla (p. ej. sin red) lanza y el estado no cambia: las cookies siguen vivas. */
  logout(): Promise<void>;
  /** Vuelve a comprobar la sesión (p. ej. tras un error de red). */
  reload(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
