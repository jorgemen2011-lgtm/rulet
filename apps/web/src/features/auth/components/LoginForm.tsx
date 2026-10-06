'use client';

import { LoginRequestSchema } from '@rulet/shared';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '../hooks/use-auth';
import { useRedirectIfAuthenticated } from '../hooks/use-redirect-if-authenticated';
import { authErrorMessage } from '../lib/auth-error-message';
import { focusFirstInvalidField, readTextField, validateForm } from '../lib/form-validation';
import type { FieldErrors } from '../lib/form-validation';
import styles from './AuthForm.module.css';

const FIELDS = ['email', 'password'] as const;
type Field = (typeof FIELDS)[number];

export interface LoginFormProps {
  /** Ruta interna a la que ir tras iniciar sesión, ya validada con `safeRedirectPath`. */
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const { login } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useRedirectIfAuthenticated(redirectTo);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = validateForm(LoginRequestSchema, {
      email: readTextField(data, 'email'),
      password: readTextField(data, 'password'),
    });
    setFormError(null);
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      focusFirstInvalidField(form, FIELDS, result.fieldErrors);
      return;
    }

    setFieldErrors({});
    setPending(true);
    try {
      // Al quedar autenticado, `useRedirectIfAuthenticated` navega a `redirectTo`.
      await login(result.data);
    } catch (error) {
      setFormError(authErrorMessage(error, 'login'));
      // La contraseña no se conserva en el DOM tras un intento fallido.
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) {
        password.value = '';
        password.focus();
      }
      // En caso de éxito se deja `pending`: el formulario sigue deshabilitado hasta que se navega.
      setPending(false);
    }
  }

  return (
    // `method="post"`: si el JS no llegase a cargar, el envío nativo nunca pondría la contraseña en la URL.
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className={styles.form}
      aria-label="Iniciar sesión"
    >
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        error={fieldErrors.email}
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
        error={fieldErrors.password}
      />
      <Button type="submit" pending={pending} fullWidth>
        {pending ? 'Entrando…' : 'Iniciar sesión'}
      </Button>
      <p className={styles.footer}>
        ¿No tienes cuenta? <Link href="/register">Crear cuenta</Link>
      </p>
    </form>
  );
}
