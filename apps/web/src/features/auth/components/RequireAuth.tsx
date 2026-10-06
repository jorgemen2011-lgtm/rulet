'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { buildLoginHref } from '@/lib/safe-redirect';
import { useAuth } from '../hooks/use-auth';

/**
 * Muestra `children` solo con sesión iniciada y, si no la hay, redirige a /login conservando la ruta actual.
 *
 * IMPORTANTE: esto es solo experiencia de usuario. La protección real la hace la API, que rechaza con 401 toda
 * petición sin un access token válido. Un usuario puede saltarse este componente, pero no obtendrá datos.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, reload } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      router.replace(buildLoginHref(`${window.location.pathname}${window.location.search}`));
    }
  }, [state.status, router]);

  if (state.status === 'authenticated') return children;

  if (state.status === 'error') {
    return (
      <Alert tone="error">
        <p>No se ha podido comprobar tu sesión. Comprueba tu conexión.</p>
        <Button variant="secondary" onClick={() => void reload()}>
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <p role="status" className="muted">
      Comprobando la sesión…
    </p>
  );
}
