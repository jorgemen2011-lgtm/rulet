import { Stack } from 'expo-router';
import { SessionLoading } from '../features/auth';
import { AppProviders, useSession } from '../providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

/**
 * Navegación protegida: cada grupo solo existe mientras su `guard` es verdadero. Si cambia la sesión
 * (login, logout o expiración) expo-router saca al usuario de las pantallas que ya no le corresponden.
 */
function RootNavigator() {
  const { state } = useSession();
  // Hasta saber si hay sesión no se monta ninguna ruta: así nunca se ve una pantalla protegida sin validar.
  if (state.status === 'loading') return <SessionLoading />;

  const authenticated = state.status === 'authenticated';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!authenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
