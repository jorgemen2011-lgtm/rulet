'use client';

import { RegisterRequestSchema } from '@rulet/shared';
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

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const;
type Field = (typeof FIELDS)[number];

export interface RegisterFormProps {
  /** Ruta interna a la que ir tras registrarse, ya validada con `safeRedirectPath`. */
  redirectTo: string;
}

export function RegisterForm({ redirectTo }: RegisterFormProps) {
  const { register } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useRedirectIfAuthenticated(redirectTo);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = readTextField(data, 'name').trim();
    const password = readTextField(data, 'password');
    // El contrato es `strictObject`: solo se envían sus campos. `name` vacío se omite (es opcional).
    const result = validateForm(RegisterRequestSchema, {
      email: readTextField(data, 'email'),
      password,
      name: name === '' ? undefined : name,
    });

    const errors: FieldErrors<Field> = result.success ? {} : { ...result.fieldErrors };
    // La confirmación solo existe en la UI: evita cuentas con una contraseña mal tecleada.
    if (!errors.password && readTextField(data, 'confirmPassword') !== password) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setFormError(null);
    setFieldErrors(errors);
    if (!result.success || Object.keys(errors).length > 0) {
      focusFirstInvalidField(form, FIELDS, errors);
      return;
    }

    setPending(true);
    try {
      // Al quedar autenticado, `useRedirectIfAuthenticated` navega a `redirectTo`.
      await register(result.data);
    } catch (error) {
      setFormError(authErrorMessage(error, 'register'));
      // En caso de éxito se deja `pending`: el formulario sigue deshabilitado hasta que se navega.
      setPending(false);
    }
  }

  return (
    // `method="post"`: si el JS no llegase a cargar, el envío nativo nunca pondría la contraseña en la URL.
    <form method="post" noValidate onSubmit={handleSubmit} className={styles.form} aria-label="Crear cuenta">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="Nombre (opcional)"
        name="name"
        autoComplete="name"
        maxLength={100}
        error={fieldErrors.name}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
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
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint="Entre 12 y 128 caracteres. Una frase larga es más segura y fácil de recordar."
        error={fieldErrors.password}
      />
      <TextField
        label="Repite la contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        maxLength={128}
        error={fieldErrors.confirmPassword}
      />
      <Button type="submit" pending={pending} fullWidth>
        {pending ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
      <p className={styles.footer}>
        ¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link>
      </p>
    </form>
  );
}
