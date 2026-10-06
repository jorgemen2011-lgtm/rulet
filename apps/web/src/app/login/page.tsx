import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { LoginForm } from '@/features/auth';
import { safeRedirectPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Iniciar sesión', robots: { index: false } };

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // `next` llega del usuario: solo se acepta si es una ruta interna (evita open redirects).
  const { next } = await searchParams;
  return (
    <Card title="Iniciar sesión">
      <LoginForm redirectTo={safeRedirectPath(next)} />
    </Card>
  );
}
