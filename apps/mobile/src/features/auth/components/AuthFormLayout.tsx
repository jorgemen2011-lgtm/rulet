import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing } from '../../../theme';

interface AuthFormLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Estructura común de las pantallas de login y registro: desplazable y sin quedar tapada por el teclado. */
export function AuthFormLayout({ title, children, footer }: AuthFormLayoutProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {children}
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Error de envío del formulario, anunciado de inmediato por los lectores de pantalla. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  formError: { fontSize: fontSizes.sm, color: colors.danger },
});
