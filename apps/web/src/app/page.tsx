import { isFeatureAvailable } from '@rulet/shared';

export default function Home() {
  return (
    <>
      <h1>Rulet</h1>
      {isFeatureAvailable('adminPanel', 'web') && <p className="muted">Panel de administración disponible</p>}
    </>
  );
}
