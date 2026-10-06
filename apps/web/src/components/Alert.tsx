import type { ReactNode } from 'react';
import styles from './Alert.module.css';

export interface AlertProps {
  tone?: 'error' | 'info' | 'success';
  children: ReactNode;
}

/** Los errores se anuncian de inmediato (`role="alert"`); el resto, sin interrumpir (`role="status"`). */
export function Alert({ tone = 'info', children }: AlertProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`${styles.alert} ${styles[tone]}`}>
      {children}
    </div>
  );
}
