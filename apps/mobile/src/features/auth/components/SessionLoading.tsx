import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { useSession } from '../../../providers';
import { colors, fontSizes, spacing } from '../../../theme';

/** Se muestra mientras se valida la sesión guardada, o si no se pudo validar por falta de conexión. */
export function SessionLoading() {
  const { state, retry } = useSession();
  const connectionError = state.status === 'loading' && state.connectionError;

  return (
    <View style={styles.container}>
      {connectionError ? (
        <>
          <Text style={styles.message} accessibilityRole="alert">
            No se ha podido conectar con el servidor. Comprueba tu conexión.
          </Text>
          <Button label="Reintentar" onPress={retry} />
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Cargando" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  message: { fontSize: fontSizes.md, color: colors.text, textAlign: 'center' },
});
