import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** Operación en curso: deshabilita el botón y lo anuncia a lectores de pantalla. */
  pending?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  pending = false,
  fullWidth = false,
  // Por defecto `button`, no `submit`: evita envíos de formulario accidentales.
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || pending} aria-busy={pending}>
      {children}
    </button>
  );
}
