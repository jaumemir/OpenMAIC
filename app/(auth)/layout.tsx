import type { ReactNode } from 'react';

/**
 * Layout per a les pàgines d'autenticació (login, accept-invite).
 * Centrat verticalment, sense sidebar ni navbar.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
