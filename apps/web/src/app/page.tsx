import { isFeatureAvailable } from '@rulet/shared';

export default function Home() {
  return (
    <main>
      <h1>Rulet web</h1>
      {isFeatureAvailable('adminPanel', 'web') && <p>Panel de administración disponible</p>}
    </main>
  );
}
