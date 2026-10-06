import { RegisterRequestSchema } from '@rulet/shared';
import type { RegisterRequest } from '@rulet/shared';
import { useSession } from '../../../providers';
import { authErrorMessage } from '../errors';
import { collectFieldErrors, useAuthForm } from './use-auth-form';
import type { FieldErrors, Validation } from './use-auth-form';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const;
export type RegisterField = (typeof FIELDS)[number];

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
    : collectFieldErrors(parsed.error, FIELDS, (field, issue) => {
        if (field === 'email') return 'Introduce un email válido';
        if (field === 'name') return 'El nombre no puede superar 100 caracteres';
        // La política de contraseñas del contrato ya trae mensajes en español.
        return issue.message;
      });
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Las contraseñas no coinciden';

  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, data: parsed.data };
  return { ok: false, errors };
}

export function useRegisterForm() {
  const { register } = useSession();
  return useAuthForm<RegisterField, RegisterRequest>({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: validateRegister,
    submit: register,
    errorMessage: (error) => authErrorMessage(error, 'register'),
  });
}
