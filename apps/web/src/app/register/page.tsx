import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { RegisterForm } from '@/features/auth';
import { safeRedirectPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Crear cuenta', robots: { index: false } };

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  // `next` llega del usuario: solo se acepta si es una ruta interna (evita open redirects).
  const { next } = await searchParams;
  return (
    <Card title="Crear cuenta">
      <RegisterForm redirectTo={safeRedirectPath(next)} />
    </Card>
  );
}
