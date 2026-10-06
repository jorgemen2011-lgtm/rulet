import { isFeatureAvailable, type Feature } from '@rulet/shared';

/** ¿Está disponible esta funcionalidad en móvil? */
export function useFeature(feature: Feature): boolean {
  return isFeatureAvailable(feature, 'mobile');
}
