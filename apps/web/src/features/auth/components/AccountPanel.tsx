'use client';

import type { Role } from '@rulet/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { useAuth } from '../hooks/use-auth';
import { authErrorMessage } from '../lib/auth-error-message';
import styles from './AccountPanel.module.css';

const ROLE_LABELS: Record<Role, string> = { user: 'Usuario', admin: 'Administrador' };

const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'long' });

/** Datos del usuario y cierre de sesión. Pensado para usarse dentro de `<RequireAuth>`. */
export function AccountPanel() {
  const { state, logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'authenticated') return null;
  const { user } = state;

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      await logout();
      router.replace('/login');
    } catch (logoutError) {
      // Sin confirmación de la API las cookies siguen siendo válidas: no se aparenta un cierre que no ha ocurrido.
      setError(authErrorMessage(logoutError, 'logout'));
      setPending(false);
    }
  }

  return (
    <>
      <dl className={styles.details}>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Nombre</dt>
        <dd>{user.name ?? '—'}</dd>
        <dt>Rol</dt>
        <dd>{ROLE_LABELS[user.role]}</dd>
        <dt>Cuenta creada</dt>
        <dd>
          <time dateTime={user.createdAt}>{dateFormatter.format(new Date(user.createdAt))}</time>
        </dd>
      </dl>
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="secondary" pending={pending} onClick={() => void handleLogout()}>
        {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
    </>
  );
}
