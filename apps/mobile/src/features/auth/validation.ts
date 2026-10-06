import { LoginRequestSchema, RegisterRequestSchema } from '@rulet/shared';
import type { LoginRequest, RegisterRequest } from '@rulet/shared';
import type { z } from 'zod';

/**
 * Validación local de los formularios de autenticación. Lógica pura (sin React ni Expo) para poder probarla;
 * los hooks de ./hooks la conectan con el estado del formulario.
 */

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type Validation<F extends string, T> = { ok: true; data: T } | { ok: false; errors: FieldErrors<F> };

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

const LOGIN_FIELDS = ['email', 'password'] as const;
export type LoginField = (typeof LOGIN_FIELDS)[number];

const LOGIN_MESSAGES: Record<LoginField, string> = {
  email: 'Introduce un email válido',
  password: 'Introduce tu contraseña',
};

export function validateLogin(values: Record<LoginField, string>): Validation<LoginField, LoginRequest> {
  const parsed = LoginRequestSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    errors: collectFieldErrors(parsed.error, LOGIN_FIELDS, (field) => LOGIN_MESSAGES[field]),
  };
}

const REGISTER_FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const;
export type RegisterField = (typeof REGISTER_FIELDS)[number];

export function validateRegister(
  values: Record<RegisterField, string>,
): Validation<RegisterField, RegisterRequest> {
  const name = values.name.trim();
  // El nombre es opcional: un campo vacío no se envía (el contrato es `strictObject` y exige longitud ≥ 1).
  const parsed = RegisterRequestSchema.safeParse({
    email: values.email,
    password: values.password,
    ...(name ? { name } : {}),
  });

  const errors: FieldErrors<RegisterField> = parsed.success
    ? {}
    : collectFieldErrors(parsed.error, REGISTER_FIELDS, (field, issue) => {
        if (field === 'email') return 'Introduce un email válido';
        if (field === 'name') return 'El nombre no puede superar 100 caracteres';
        // La política de contraseñas del contrato ya trae mensajes en español.
        return issue.message;
      });
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Las contraseñas no coinciden';

  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, data: parsed.data };
  return { ok: false, errors };
}
