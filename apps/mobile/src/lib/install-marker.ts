import { File, Paths } from 'expo-file-system';
import type { InstallMarker } from './first-launch';

/**
 * Archivo vacío en el directorio de documentos de la app. A diferencia del Keychain, el sistema lo borra al
 * desinstalar. No se usa la caché porque el sistema puede vaciarla y eso cerraría la sesión sin motivo.
 */
const MARKER_NAME = '.rulet-installed';

export function createFileInstallMarker(name: string = MARKER_NAME): InstallMarker {
  const file = new File(Paths.document, name);
  return {
    // La API de expo-file-system es síncrona; se envuelve en promesas para cumplir la interfaz.
    async exists() {
      return file.exists;
    },
    async create() {
      file.create({ overwrite: true });
    },
  };
}

export const installMarker = createFileInstallMarker();
