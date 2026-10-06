import type { z } from 'zod';
import { es } from 'zod/locales';

const spanishErrors = es().localeError;

/**
 * Mensajes en español para las reglas sin mensaje propio en el contrato. Los mensajes definidos en los
 * esquemas de @rulet/shared (email, longitud de contraseña) tienen prioridad sobre este mapa.
 */
const errorMap: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'too_small' && issue.minimum === 1) return 'Este campo es obligatorio';
  if (issue.code === 'too_big' && issue.origin === 'string')
    return `No puede superar ${issue.maximum} caracteres`;
  return spanishErrors(issue);
};

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type FormValidation<Data, Field extends string> =
  { success: true; data: Data } | { success: false; fieldErrors: FieldErrors<Field> };

/**
 * Valida en el cliente con el MISMO esquema que aplicará la API, para dar feedback inmediato. No sustituye a
 * la validación del servidor: un cliente modificado puede saltársela.
 * Devuelve el primer error de cada campo y los datos ya normalizados (p. ej. email en minúsculas).
 */
export function validateForm<S extends z.ZodType, Field extends string>(
  schema: S,
  input: Record<Field, unknown>,
): FormValidation<z.output<S>, Field> {
  const result = schema.safeParse(input, { error: errorMap });
  if (result.success) return { success: true, data: result.data };

  const fieldErrors: FieldErrors<Field> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && field in input && !(field in fieldErrors)) {
      fieldErrors[field as Field] = issue.message;
    }
  }
  return { success: false, fieldErrors };
}

/** Lee un campo de texto de un `FormData`; un archivo o un campo ausente se tratan como cadena vacía. */
export function readTextField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * Lleva el foco al primer campo con error (en el orden visual de `fields`) para que teclado y lectores de
 * pantalla lleguen a él directamente.
 */
export function focusFirstInvalidField<Field extends string>(
  form: HTMLFormElement,
  fields: readonly Field[],
  errors: FieldErrors<Field>,
): void {
  const first = fields.find((name) => errors[name]);
  if (!first) return;
  const element = form.elements.namedItem(first);
  if (element instanceof HTMLInputElement) element.focus();
}
