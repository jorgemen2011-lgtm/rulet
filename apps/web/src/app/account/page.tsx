import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { AccountPanel, RequireAuth } from '@/features/auth';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };

/**
 * Protegida en el CLIENTE solo por experiencia de usuario (redirige a /login sin sesión). La protección real
 * la hace la API: `GET /v1/users/me` y cualquier dato de la cuenta exigen un access token válido.
 */
export default function AccountPage() {
  return (
    <Card title="Mi cuenta">
      <RequireAuth>
        <AccountPanel />
      </RequireAuth>
    </Card>
  );
}
