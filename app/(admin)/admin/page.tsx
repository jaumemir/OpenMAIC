import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { fromDbJson } from '@/lib/db-compat';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const hdrs = await headers();
  const session = await getSessionFromHeaders(hdrs);

  const [userCount, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } },
    }),
  ]);

  const adminName = (session?.user as { name?: string } | undefined)?.name ?? 'Admin';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Panel d&apos;administració</h1>
          <p className="text-muted-foreground mt-1">Benvingut/da, {adminName}</p>
        </div>

        {/* Resum */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard title="Usuaris registrats" value={userCount} />
          <StatCard title="Accions avui" value={recentLogs.filter((l) => isToday(l.createdAt)).length} />
          <StatCard title="Accions totals (últimes 24h)" value={recentLogs.length} />
        </div>

        {/* Navegació */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <AdminNavCard href="/admin/users" title="Usuaris" description="Gestiona usuaris i invitacions" />
          <AdminNavCard href="/admin/config" title="Configuració" description="Models permesos i paràmetres globals" />
          <AdminNavCard href="/admin/courses" title="Cursos generats" description="Tots els cursos del sistema amb propietari" />
          <AdminNavCard href="/admin/audit" title="Auditoria" description="Log complet d'accions del sistema" />
        </div>

        {/* Últimes accions */}
        <div>
          <h2 className="text-lg font-medium mb-4">Activitat recent</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Acció</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Usuari</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Entitat</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {log.user
                        ? `${log.user.profile?.firstName ?? ''} ${log.user.profile?.lastName ?? ''}`.trim() || log.user.email
                        : 'Sistema'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {log.entityType ? `${log.entityType}/${log.entityId?.slice(0, 8)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleString('ca-ES')}
                    </td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Sense activitat registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="border rounded-lg px-5 py-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function AdminNavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="border rounded-lg px-5 py-4 hover:bg-muted/30 transition-colors block"
    >
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </Link>
  );
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
