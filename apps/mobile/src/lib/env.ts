import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

/** Variantes de build (ver app.config.ts y eas.json). */
export const APP_VARIANTS = ['development', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

/**
 * La variante llega en `extra.variant` del manifiesto. Si falta o es desconocida se asume `production`:
 * ante la duda se aplican las reglas más estrictas.
 */
function readVariant(): AppVariant {
  const parsed = z.enum(APP_VARIANTS).safeParse(Constants.expoConfig?.extra?.variant);
  return parsed.success ? parsed.data : 'production';
}

/** En desarrollo, la API local: el emulador de Android ve el host en 10.0.2.2; el simulador de iOS, en localhost. */
const DEV_DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const HttpUrlSchema = z.url({
  protocol: /^https?$/,
  message: 'EXPO_PUBLIC_API_URL debe ser una URL http(s)',
});
const HttpsUrlSchema = z.url({
  protocol: /^https$/,
  message: 'EXPO_PUBLIC_API_URL debe ser https en preview y producción',
});

function readApiUrl(variant: AppVariant): string {
  // Expo sustituye `process.env.EXPO_PUBLIC_*` en build, así que hay que leer cada variable por su nombre.
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;
  if (variant === 'development') return HttpUrlSchema.parse(raw ?? DEV_DEFAULT_API_URL);
  // Fuera de desarrollo no hay valor por defecto: una build sin API configurada debe fallar al arrancar.
  if (!raw) throw new Error(`EXPO_PUBLIC_API_URL es obligatoria en la variante "${variant}".`);
  return HttpsUrlSchema.parse(raw);
}

const variant = readVariant();

/** Configuración pública de la app, validada al cargar el módulo. */
export const env = {
  variant,
  apiUrl: readApiUrl(variant),
  /**
   * Solo en desarrollo: permite `http://` hacia IPs de la red local (dispositivo físico contra el portátil).
   * `@rulet/api-client` ya admite http hacia localhost y 10.0.2.2 sin este permiso.
   */
  allowInsecureHttp: variant === 'development',
} as const;
