import { z } from 'zod';

/**
 * Lógica pura de la configuración pública (sin dependencias de Expo ni de React Native) para poder probarla.
 * `env.ts` le pasa los valores reales.
 */

/** Variantes de build (ver app.config.ts y eas.json). */
export const APP_VARIANTS = ['development', 'preview', 'production'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

/** Si la variante falta o es desconocida se asume `production`: ante la duda se aplican las reglas más estrictas. */
export function parseVariant(raw: unknown): AppVariant {
  const parsed = z.enum(APP_VARIANTS).safeParse(raw);
  return parsed.success ? parsed.data : 'production';
}

/** En desarrollo, la API local: el emulador de Android ve el host en 10.0.2.2; el simulador de iOS, en localhost. */
export function devDefaultApiUrl(os: string): string {
  return os === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

const HttpUrlSchema = z.url({
  protocol: /^https?$/,
  message: 'EXPO_PUBLIC_API_URL debe ser una URL http(s)',
});
const HttpsUrlSchema = z.url({
  protocol: /^https$/,
  message: 'EXPO_PUBLIC_API_URL debe ser https en preview y producción',
});

/** Valida la URL de la API para la variante. Lanza si no es válida: la app no debe arrancar mal configurada. */
export function readApiUrl(variant: AppVariant, raw: string | undefined, devDefault: string): string {
  const value = raw?.trim() || undefined;
  if (variant === 'development') return HttpUrlSchema.parse(value ?? devDefault);
  // Fuera de desarrollo no hay valor por defecto: una build sin API configurada debe fallar al arrancar.
  if (!value) throw new Error(`EXPO_PUBLIC_API_URL es obligatoria en la variante "${variant}".`);
  return HttpsUrlSchema.parse(value);
}
