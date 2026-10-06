import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type Validation<F extends string, T> = { ok: true; data: T } | { ok: false; errors: FieldErrors<F> };

export interface AuthFormOptions<F extends string, T> {
  initialValues: Record<F, string>;
  /** Valida los valores del formulario y los convierte en el cuerpo de la petición. */
  validate(values: Record<F, string>): Validation<F, T>;
  submit(data: T): Promise<void>;
  /** Mensaje genérico para un fallo de `submit`. */
  errorMessage(error: unknown): string;
}

export interface AuthForm<F extends string> {
  values: Record<F, string>;
  errors: FieldErrors<F>;
  /** Error del envío (no de un campo concreto). */
  formError: string | null;
  submitting: boolean;
  setValue(field: F, value: string): void;
  handleSubmit(): Promise<void>;
}

/** Estado y envío de un formulario de autenticación: validación local, envío único y error genérico. */
export function useAuthForm<F extends string, T>({
  initialValues,
  validate,
  submit,
  errorMessage,
}: AuthFormOptions<F, T>): AuthForm<F> {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<F>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Además del estado: dos pulsaciones en el mismo frame verían aún `submitting === false`.
  const inFlight = useRef(false);

  const setValue = useCallback((field: F, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const handleSubmit = async () => {
    if (inFlight.current) return;
    setFormError(null);
    const result = validate(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    inFlight.current = true;
    setSubmitting(true);
    try {
      await submit(result.data);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return { values, errors, formError, submitting, setValue, handleSubmit };
}

/** Primer mensaje de error por campo de primer nivel; `messageFor` decide el texto que ve el usuario. */
export function collectFieldErrors<F extends string>(
  error: z.ZodError,
  fields: readonly F[],
  messageFor: (field: F, issue: z.core.$ZodIssue) => string,
): FieldErrors<F> {
  const errors: FieldErrors<F> = {};
  for (const issue of error.issues) {
    const field = fields.find((candidate) => candidate === issue.path[0]);
    if (field && errors[field] === undefined) errors[field] = messageFor(field, issue);
  }
  return errors;
}
