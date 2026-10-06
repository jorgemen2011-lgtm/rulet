import type { TokenStore } from '@rulet/api-client';

/** Marca de instalación: existe desde la primera ejecución y desaparece al desinstalar la app. */
export interface InstallMarker {
  exists(): Promise<boolean>;
  create(): Promise<void>;
}

export interface FirstLaunchDeps {
  marker: InstallMarker;
  tokenStore: Pick<TokenStore, 'clear'>;
}

/**
 * En la primera ejecución de una instalación borra cualquier sesión heredada y crea la marca. Devuelve `true`
 * si era la primera ejecución.
 *
 * En iOS los elementos del Keychain sobreviven a la desinstalación: sin esto, reinstalar la app restauraría la
 * sesión de quien la desinstaló. La marca se crea solo después de limpiar: si `clear()` falla, el error se
 * propaga (quien llama debe tratarlo como "sin sesión") y se vuelve a intentar en el siguiente arranque.
 */
export async function clearSessionOnFirstLaunch({ marker, tokenStore }: FirstLaunchDeps): Promise<boolean> {
  if (await marker.exists()) return false;
  await tokenStore.clear();
  await marker.create();
  return true;
}
