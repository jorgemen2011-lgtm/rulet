import type { Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';

export interface TextFieldProps extends Omit<
  TextInputProps,
  'style' | 'accessibilityLabel' | 'accessibilityHint'
> {
  /** Etiqueta visible; también es el nombre accesible del campo. */
  label: string;
  /** Mensaje de validación. */
  error?: string;
  ref?: Ref<TextInput>;
}

/** Campo de texto con etiqueta y error accesibles. */
export function TextField({ label, error, ref, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {/* La etiqueta ya es el nombre accesible del input: se oculta para que no se lea dos veces. */}
      <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        ref={ref}
        {...inputProps}
        accessibilityLabel={label}
        // El error se lee al enfocar el campo además de anunciarse cuando aparece.
        accessibilityHint={error}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: fontSizes.sm, color: colors.text, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: fontSizes.sm, color: colors.danger },
});
