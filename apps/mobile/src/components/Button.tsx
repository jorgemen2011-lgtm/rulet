import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Muestra un indicador y bloquea pulsaciones (evita envíos dobles). */
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
}

/** Botón accesible con estado de carga. */
export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.primaryContrast : colors.primary} />
      ) : (
        <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dimmed: { opacity: 0.7 },
  label: { fontSize: fontSizes.md, fontWeight: '600' },
  primaryLabel: { color: colors.primaryContrast },
  secondaryLabel: { color: colors.text },
});
