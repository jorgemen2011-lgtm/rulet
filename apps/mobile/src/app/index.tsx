import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { useFeature } from '../hooks/use-feature';
import { colors, fontSizes } from '../theme';

export default function Home() {
  const hasPush = useFeature('pushNotifications');
  return (
    <Screen>
      <Text style={styles.title}>Rulet</Text>
      {hasPush && <Text style={styles.muted}>Notificaciones push disponibles</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSizes.xxl, color: colors.text, fontWeight: '700' },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
});
