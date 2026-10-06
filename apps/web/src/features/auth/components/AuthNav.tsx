'use client';

import Link from 'next/link';
import { useAuth } from '../hooks/use-auth';
import styles from './AuthNav.module.css';

/** Enlaces de la cabecera según haya sesión o no. */
export function AuthNav() {
  const { state } = useAuth();

  return (
    <nav aria-label="Cuenta" className={styles.nav}>
      {state.status === 'authenticated' ? (
        <Link href="/account">Mi cuenta</Link>
      ) : (
        // Mientras se comprueba la sesión no se muestra nada, para no "parpadear" los enlaces de acceso.
        state.status !== 'loading' && (
          <>
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/register">Crear cuenta</Link>
          </>
        )
      )}
    </nav>
  );
}
