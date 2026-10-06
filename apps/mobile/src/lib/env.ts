import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { devDefaultApiUrl, parseVariant, readApiUrl } from './env-config';

export { APP_VARIANTS } from './env-config';
export type { AppVariant } from './env-config';

/** La variante llega en `extra.variant` del manifiesto (ver app.config.ts). */
const variant = parseVariant(Constants.expoConfig?.extra?.variant);

/** Configuración pública de la app, validada al cargar el módulo. */
export const env = {
  variant,
  // Expo sustituye `process.env.EXPO_PUBLIC_*` en build, así que hay que leer cada variable por su nombre.
  apiUrl: readApiUrl(variant, process.env.EXPO_PUBLIC_API_URL, devDefaultApiUrl(Platform.OS)),
  /**
   * Solo en desarrollo: permite `http://` hacia IPs de la red local (dispositivo físico contra el portátil).
   * `@rulet/api-client` ya admite http hacia localhost y 10.0.2.2 sin este permiso.
   */
  allowInsecureHttp: variant === 'development',
} as const;
