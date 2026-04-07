'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { ChevronRight, Home, LogOut } from 'lucide-react';

interface AdminNavProps {
  displayName: string;
}

const SECTION_LABELS: Record<string, string> = {
  users: 'Usuaris',
  config: 'Configuració',
  courses: 'Cursos generats',
  audit: 'Auditoria',
};

export default function AdminNav({ displayName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Construir breadcrumb des del pathname
  // p.ex. /admin/users → ['admin', 'users']
  const segments = pathname.split('/').filter(Boolean);
  // segments[0] = 'admin', segments[1] = secció (opcional)
  const section = segments[1] as string | undefined;

  async function handleLogout() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login');
          router.refresh();
        },
      },
    });
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">

        {/* Esquerra: breadcrumb */}
        <div className="flex items-center gap-1 text-sm min-w-0">
          {/* Botó tornada a l'app */}
          <Link
            href="/"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Tornar a l'aplicació"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">App</span>
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

          {/* Arrel del panell */}
          {section ? (
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Panel
            </Link>
          ) : (
            <span className="font-medium text-foreground">Panel</span>
          )}

          {/* Secció actual */}
          {section && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span className="font-medium text-foreground truncate">
                {SECTION_LABELS[section] ?? section}
              </span>
            </>
          )}
        </div>

        {/* Dreta: usuari + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground hidden sm:block max-w-[140px] truncate">
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            title="Tancar sessió"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sortir</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
