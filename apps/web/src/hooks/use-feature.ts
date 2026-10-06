import { isFeatureAvailable, type Feature } from '@rulet/shared';

/** ¿Está disponible esta funcionalidad en web? */
export function useFeature(feature: Feature): boolean {
  return isFeatureAvailable(feature, 'web');
}
