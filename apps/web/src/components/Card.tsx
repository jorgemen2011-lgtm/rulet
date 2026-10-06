import type { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  /** Título principal de la pantalla (se renderiza como `h1`). */
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
