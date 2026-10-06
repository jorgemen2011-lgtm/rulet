import { LoginRequestSchema } from '@rulet/shared';
import type { LoginRequest } from '@rulet/shared';
import { useSession } from '../../../providers';
import { authErrorMessage } from '../errors';
import { collectFieldErrors, useAuthForm } from './use-auth-form';
import type { Validation } from './use-auth-form';

const FIELDS = ['email', 'password'] as const;
export type LoginField = (typeof FIELDS)[number];

const MESSAGES: Record<LoginField, string> = {
  email: 'Introduce un email válido',
  password: 'Introduce tu contraseña',
};

export function validateLogin(values: Record<LoginField, string>): Validation<LoginField, LoginRequest> {
  const parsed = LoginRequestSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: collectFieldErrors(parsed.error, FIELDS, (field) => MESSAGES[field]) };
}

export function useLoginForm() {
  const { login } = useSession();
  return useAuthForm<LoginField, LoginRequest>({
    initialValues: { email: '', password: '' },
    validate: validateLogin,
    submit: login,
    errorMessage: (error) => authErrorMessage(error, 'login'),
  });
}
