import { StyleSheet, Text, View } from 'react-native';
import { isFeatureAvailable } from '@rulet/shared';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text>Rulet mobile</Text>
      {isFeatureAvailable('pushNotifications', 'mobile') && <Text>Push habilitado</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
