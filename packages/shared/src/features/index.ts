import type { Platform } from '../platform';

/**
 * Catálogo de funcionalidades y en qué plataforma existe cada una.
 * Fuente única de verdad: las apps lo usan para mostrar/ocultar UI y la API
 * para rechazar peticiones de una plataforma que no tiene la funcionalidad.
 */
export const FEATURES = {
  auth: ['web', 'mobile'],
  profile: ['web', 'mobile'],
  pushNotifications: ['mobile'],
  adminPanel: ['web'],
} as const satisfies Record<string, readonly Platform[]>;

export type Feature = keyof typeof FEATURES;

export function isFeatureAvailable(feature: Feature, platform: Platform): boolean {
  return (FEATURES[feature] as readonly Platform[]).includes(platform);
}

export function featuresFor(platform: Platform): Feature[] {
  return (Object.keys(FEATURES) as Feature[]).filter((f) => isFeatureAvailable(f, platform));
}
