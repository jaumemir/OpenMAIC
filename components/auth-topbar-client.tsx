'use client';

import { signOut } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, Settings2 } from 'lucide-react';

interface AuthTopbarClientProps {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export default function AuthTopbarClient({ name, email, role }: AuthTopbarClientProps) {
  const router = useRouter();

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

  // Inicials per a l'avatar
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex items-center gap-2">
      {role === 'admin' && (
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Settings2 className="h-3.5 w-3.5" />
            Admin
          </Button>
        </Link>
      )}

      {/* Avatar + nom */}
      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold select-none">
          {initials || email[0]?.toUpperCase()}
        </div>
        <span className="text-sm text-foreground hidden sm:block max-w-[120px] truncate">
          {name}
        </span>
      </div>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Tancar sessió"
        onClick={handleLogout}
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
