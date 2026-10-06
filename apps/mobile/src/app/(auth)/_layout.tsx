import { Stack } from 'expo-router';

// El login es la base de la pila: desde el registro se puede volver atrás a él.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
