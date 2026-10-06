'use client';

import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { use{{namePascal}} } from '../hooks/use-{{name}}';
import styles from './{{entityPascal}}List.module.css';

/**
 * Lista de {{name}}. Necesita sesión: úsalo dentro de `<RequireAuth>` (la protección real la hace la API).
 * Todo el contenido se renderiza como texto; nunca como HTML.
 */
export function {{entityPascal}}List() {
  const { state, reload } = use{{namePascal}}();

  if (state.status === 'loading') return <p role="status">Cargando…</p>;

  if (state.status === 'error') {
    return (
      <>
        <Alert tone="error">{state.message}</Alert>
        <Button variant="secondary" onClick={reload}>
          Reintentar
        </Button>
      </>
    );
  }

  if (state.items.length === 0) return <p className={styles.empty}>Todavía no hay nada aquí.</p>;

  return (
    <ul className={styles.list}>
      {state.items.map((item) => (
        <li key={item.id} className={styles.item}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
