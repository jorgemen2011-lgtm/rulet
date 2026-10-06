import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Variantes de la app. Cada una tiene su propio bundle id, así se pueden instalar
 * desarrollo, preview y producción en el mismo dispositivo. La variante la fija EAS
 * (ver eas.json) mediante APP_VARIANT.
 */
const VARIANTS = {
  development: { name: 'Rulet (Dev)', id: 'com.rulet.app.dev' },
  preview: { name: 'Rulet (Preview)', id: 'com.rulet.app.preview' },
  production: { name: 'Rulet', id: 'com.rulet.app' },
} as const;

type Variant = keyof typeof VARIANTS;

/**
 * Sin APP_VARIANT se asume desarrollo solo en local (`expo start`, `expo run:*`). En EAS (`EAS_BUILD`) la
 * variante es obligatoria: un perfil nuevo que olvide fijarla no debe producir en silencio una build con el
 * bundle id y las reglas de desarrollo (http permitido, sin https obligatorio).
 */
export function resolveVariant(raw: string | undefined, easBuild: boolean): Variant {
  if (raw === undefined && easBuild) {
    throw new Error(
      `APP_VARIANT es obligatoria en las builds de EAS (fíjala en el perfil de eas.json). Valores admitidos: ${Object.keys(VARIANTS).join(', ')}.`,
    );
  }
  const value = raw ?? 'development';
  // Un valor mal escrito no debe caer en silencio a otra variante (p. ej. una build de producción con reglas de dev).
  if (!Object.hasOwn(VARIANTS, value)) {
    throw new Error(
      `APP_VARIANT inválida: "${value}". Valores admitidos: ${Object.keys(VARIANTS).join(', ')}.`,
    );
  }
  return value as Variant;
}

// EAS define `EAS_BUILD` en sus workers de build.
const variant = resolveVariant(process.env.APP_VARIANT, Boolean(process.env.EAS_BUILD));
const { name, id } = VARIANTS[variant];

// Comprobación temprana en build: fuera de desarrollo la API solo se alcanza por https. La app lo vuelve a
// validar al arrancar (src/lib/env.ts), que además exige que la variable exista.
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (variant !== 'development' && apiUrl && !apiUrl.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_URL debe ser https en la variante "${variant}".`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug: 'rulet',
  scheme: 'rulet',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: { bundleIdentifier: id, supportsTablet: true },
  // Sin copias de seguridad de Android: los datos de la app (y cualquier rastro de sesión) no salen del dispositivo.
  android: { package: id, allowBackup: false },
  plugins: [
    'expo-router',
    // No se usa biometría: `faceIDPermission: false` evita declarar un permiso de Face ID innecesario.
    // Se mantienen las reglas de backup del plugin como defensa en profundidad si se reactivase allowBackup.
    ['expo-secure-store', { faceIDPermission: false, configureAndroidBackup: true }],
  ],
  experiments: { typedRoutes: true },
  extra: { variant },
});
