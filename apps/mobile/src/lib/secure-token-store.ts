import type { TokenStore } from '@rulet/api-client';
import { AuthTokensSchema } from '@rulet/shared';
import type { AuthTokens } from '@rulet/shared';
import * as SecureStore from 'expo-secure-store';

/** Clave en el Keychain (iOS) / Keystore (Android). SecureStore solo admite alfanuméricos, `.`, `-` y `_`. */
const TOKENS_KEY = 'rulet.auth.tokens';

/**
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: los tokens solo se leen con el dispositivo desbloqueado, no se sincronizan
 * con iCloud Keychain y no se restauran en otro dispositivo desde una copia de seguridad.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * TokenStore sobre expo-secure-store. Nunca AsyncStorage: guarda en claro y entra en las copias de seguridad.
 *
 * Sin caché en memoria a propósito: el almacén seguro es la única fuente de verdad y no hay que sincronizar
 * nada entre lecturas y escrituras concurrentes. Leer del Keychain cuesta del orden de milisegundos.
 */
export function createSecureTokenStore(key: string = TOKENS_KEY): TokenStore {
  return {
    async get(): Promise<AuthTokens | null> {
      const raw = await SecureStore.getItemAsync(key, OPTIONS);
      if (raw === null) return null;
      const parsed = AuthTokensSchema.safeParse(parseJson(raw));
      if (parsed.success) return parsed.data;
      // Datos corruptos o de un formato antiguo: se descartan y el usuario vuelve a iniciar sesión.
      await SecureStore.deleteItemAsync(key, OPTIONS);
      return null;
    },
    async set(tokens: AuthTokens): Promise<void> {
      await SecureStore.setItemAsync(key, JSON.stringify(tokens), OPTIONS);
    },
    async clear(): Promise<void> {
      await SecureStore.deleteItemAsync(key, OPTIONS);
    },
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const secureTokenStore = createSecureTokenStore();
