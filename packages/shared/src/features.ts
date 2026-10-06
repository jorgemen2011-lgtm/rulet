import type { Platform } from './platform';

/**
 * Catálogo de funcionalidades y en qué plataforma está disponible cada una.
 * Es la fuente única de verdad para lo que existe solo en web, solo en móvil
 * o en ambas. La API puede usarlo también para validar peticiones por plataforma.
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
