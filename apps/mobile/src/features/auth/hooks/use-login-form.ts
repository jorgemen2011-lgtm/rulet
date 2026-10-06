import type { LoginRequest } from '@rulet/shared';
import { useSession } from '../../../providers';
import { authErrorMessage } from '../errors';
import { validateLogin } from '../validation';
import type { LoginField } from '../validation';
import { useAuthForm } from './use-auth-form';

export type { LoginField } from '../validation';

export function useLoginForm() {
  const { login } = useSession();
  return useAuthForm<LoginField, LoginRequest>({
    initialValues: { email: '', password: '' },
    validate: validateLogin,
    submit: login,
    errorMessage: (error) => authErrorMessage(error, 'login'),
  });
}
