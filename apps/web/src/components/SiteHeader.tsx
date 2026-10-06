import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './SiteHeader.module.css';

export interface SiteHeaderProps {
  /** Navegación (la compone el layout; este componente no conoce la sesión). */
  children?: ReactNode;
}

export function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Rulet
        </Link>
        {children}
      </div>
    </header>
  );
}
