import { isFeatureAvailable } from '@rulet/shared';

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Rulet</h1>
      {isFeatureAvailable('adminPanel', 'web') && <p>Panel de administración disponible</p>}
    </main>
  );
}
