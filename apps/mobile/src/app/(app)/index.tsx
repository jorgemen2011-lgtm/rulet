import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { SignOutButton } from '../../features/auth';
import { useFeature } from '../../hooks/use-feature';
import { useSession } from '../../providers';
import { colors, fontSizes } from '../../theme';

export default function Home() {
  const { state } = useSession();
  const hasPush = useFeature('pushNotifications');
  const user = state.status === 'authenticated' ? state.user : null;

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Rulet
      </Text>
      {user && <Text style={styles.subtitle}>Hola, {user.name ?? user.email}</Text>}
      {hasPush && <Text style={styles.muted}>Notificaciones push disponibles</Text>}
      <SignOutButton />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSizes.xxl, color: colors.text, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, color: colors.text },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
});
