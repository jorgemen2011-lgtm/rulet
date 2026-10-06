import type { AuthTokens } from '@rulet/shared';

/**
 * Almacén de tokens que el cliente usa en móvil. Cada app aporta su implementación:
 * en móvil debe ser almacenamiento cifrado del sistema (p. ej. `expo-secure-store`), nunca AsyncStorage.
 * En web no se usa: los tokens viajan en cookies httpOnly inaccesibles para JavaScript.
 */
export interface TokenStore {
  get(): Promise<AuthTokens | null>;
  set(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

/** Almacén en memoria: útil en tests y en procesos efímeros. No persiste entre reinicios. */
export function createMemoryTokenStore(initial: AuthTokens | null = null): TokenStore {
  let tokens = initial;
  return {
    get: () => Promise.resolve(tokens),
    set: (next) => {
      tokens = next;
      return Promise.resolve();
    },
    clear: () => {
      tokens = null;
      return Promise.resolve();
    },
  };
}
