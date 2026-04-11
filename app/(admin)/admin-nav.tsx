'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { ChevronRight, LayoutDashboard, LogOut } from 'lucide-react';

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

  const segments = pathname.split('/').filter(Boolean);
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
    <nav className="border-b border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Esquerra: breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-muted/50"
            title="Tornar a l'aplicació"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">App</span>
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

          {section ? (
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-muted/50"
            >
              Panel
            </Link>
          ) : (
            <span className="font-semibold text-foreground px-2 py-1">Panel</span>
          )}

          {section && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-semibold text-foreground truncate px-2 py-1">
                {SECTION_LABELS[section] ?? section}
              </span>
            </>
          )}
        </div>

        {/* Dreta: usuari + logout */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm text-muted-foreground hidden md:block max-w-[180px] truncate px-2">
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50"
            title="Tancar sessió"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sortir</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
