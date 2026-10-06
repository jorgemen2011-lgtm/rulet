import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { colors, fontSizes, radii, spacing } from '../../../theme';
import { use{{namePascal}} } from '../hooks/use-{{name}}';

/** Lista de {{name}}. Pensado para pantallas del grupo `(app)`, que solo se montan con sesión. */
export function {{entityPascal}}List() {
  const { state, reload } = use{{namePascal}}();

  if (state.status === 'loading') {
    return <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Cargando" />;
  }

  if (state.status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.message} accessibilityRole="alert">
          {state.message}
        </Text>
        <Button label="Reintentar" variant="secondary" onPress={reload} />
      </View>
    );
  }

  if (state.items.length === 0) {
    return <Text style={styles.message}>Todavía no hay nada aquí.</Text>;
  }

  return (
    <View style={styles.container} accessibilityRole="list">
      {state.items.map((item) => (
        <Text key={item.id} style={styles.item}>
          {item.name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', gap: spacing.sm },
  message: { fontSize: fontSizes.md, color: colors.text, textAlign: 'center' },
  item: {
    fontSize: fontSizes.md,
    color: colors.text,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
});
