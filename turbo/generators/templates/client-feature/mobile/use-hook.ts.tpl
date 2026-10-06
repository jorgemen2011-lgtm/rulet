import { type {{entityPascal}}, {{entityPascal}}ListSchema } from '@rulet/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { {{nameCamel}}ErrorMessage } from '../errors';

export type {{namePascal}}State =
  | { status: 'loading' }
  | { status: 'ready'; items: {{entityPascal}}[] }
  | { status: 'error'; message: string };

export interface Use{{namePascal}}Result {
  state: {{namePascal}}State;
  /** Vuelve a pedir la lista (p. ej. tras un error de red). */
  reload(): void;
}

/**
 * Lista de {{name}} del usuario autenticado. El cliente añade el Bearer token del almacén seguro, renueva la
 * sesión si caduca y valida la respuesta con el contrato de @rulet/shared.
 */
export function use{{namePascal}}(): Use{{namePascal}}Result {
  const [state, setState] = useState<{{namePascal}}State>({ status: 'loading' });
  // Cada valor distinto lanza una petición (montaje y `reload`).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Al desmontar o recargar se cancela la petición en curso: una respuesta tardía no pisa el estado.
    const controller = new AbortController();
    api.request({{entityPascal}}ListSchema, '/{{name}}', { signal: controller.signal }).then(
      (items) => setState({ status: 'ready', items }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: {{nameCamel}}ErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { state, reload };
}
