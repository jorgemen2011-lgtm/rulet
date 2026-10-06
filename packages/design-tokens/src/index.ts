/**
 * Tokens de diseño compartidos por web y móvil: valores puros (números y strings),
 * sin depender de CSS ni de StyleSheet, para que cada plataforma los traduzca a su sistema.
 */
export const colors = {
  primary: '#4F46E5',
  primaryContrast: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F5F5F7',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radii = { sm: 4, md: 8, lg: 16, full: 9999 } as const;

export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const tokens = { colors, spacing, radii, fontSizes } as const;
export type Tokens = typeof tokens;
