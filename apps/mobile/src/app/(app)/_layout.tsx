import { Stack } from 'expo-router';

/** Pantallas que exigen sesión. La protección la aplica el layout raíz con `Stack.Protected`. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
