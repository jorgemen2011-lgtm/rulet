import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { AuthNav, AuthProvider } from '@/features/auth';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'Rulet', template: '%s · Rulet' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // La CSP usa un nonce distinto en cada petición (src/proxy.ts) y Next solo puede añadirlo a sus <script> al
  // renderizar bajo demanda. Esperar a la conexión fuerza el renderizado dinámico de todas las rutas: una
  // página prerenderizada llevaría scripts sin nonce y la CSP la dejaría sin JavaScript.
  await connection();

  return (
    <html lang="es">
      <body>
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <AuthProvider>
          <SiteHeader>
            <AuthNav />
          </SiteHeader>
          <main id="main" className="container">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
