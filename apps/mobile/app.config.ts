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
const variant = (process.env.APP_VARIANT ?? 'development') as Variant;
const { name, id } = VARIANTS[variant] ?? VARIANTS.development;

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
  android: { package: id },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
  extra: { variant },
});
