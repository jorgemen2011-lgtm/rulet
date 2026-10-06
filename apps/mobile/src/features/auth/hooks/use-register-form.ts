import type { RegisterRequest } from '@rulet/shared';
import { useSession } from '../../../providers';
import { authErrorMessage } from '../errors';
import { validateRegister } from '../validation';
import type { RegisterField } from '../validation';
import { useAuthForm } from './use-auth-form';

export type { RegisterField } from '../validation';

export function useRegisterForm() {
  const { register } = useSession();
  return useAuthForm<RegisterField, RegisterRequest>({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: validateRegister,
    submit: register,
    errorMessage: (error) => authErrorMessage(error, 'register'),
  });
}
