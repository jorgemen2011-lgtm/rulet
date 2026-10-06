import { describe, expect, it, vi } from 'vitest';
import { clearSessionOnFirstLaunch } from './first-launch';
import type { InstallMarker } from './first-launch';

/** Marca en memoria que registra el orden de las llamadas junto con las del almacén. */
function setup({ installed = false, clearFails = false } = {}) {
  const calls: string[] = [];
  let exists = installed;
  const marker: InstallMarker = {
    exists: vi.fn(async () => exists),
    create: vi.fn(async () => {
      calls.push('marker.create');
      exists = true;
    }),
  };
  const tokenStore = {
    clear: vi.fn(async () => {
      calls.push('tokenStore.clear');
      if (clearFails) throw new Error('Keychain no disponible');
    }),
  };
  return { marker, tokenStore, calls };
}

describe('clearSessionOnFirstLaunch', () => {
  it('en la primera ejecución borra la sesión heredada y después crea la marca', async () => {
    const deps = setup();

    await expect(clearSessionOnFirstLaunch(deps)).resolves.toBe(true);

    expect(deps.calls).toEqual(['tokenStore.clear', 'marker.create']);
  });

  it('con la marca presente no toca la sesión', async () => {
    const deps = setup({ installed: true });

    await expect(clearSessionOnFirstLaunch(deps)).resolves.toBe(false);

    expect(deps.tokenStore.clear).not.toHaveBeenCalled();
    expect(deps.marker.create).not.toHaveBeenCalled();
  });

  it('solo limpia una vez por instalación', async () => {
    const deps = setup();

    await clearSessionOnFirstLaunch(deps);
    await expect(clearSessionOnFirstLaunch(deps)).resolves.toBe(false);

    expect(deps.tokenStore.clear).toHaveBeenCalledTimes(1);
  });

  it('si la limpieza falla propaga el error y no crea la marca, para reintentarlo en el siguiente arranque', async () => {
    const deps = setup({ clearFails: true });

    await expect(clearSessionOnFirstLaunch(deps)).rejects.toThrow('Keychain no disponible');

    expect(deps.marker.create).not.toHaveBeenCalled();
  });
});
