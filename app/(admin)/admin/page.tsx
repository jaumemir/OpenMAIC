import { headers, cookies } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Users, Settings, BookOpen, ClipboardList } from 'lucide-react';
import { translate, defaultLocale, type Locale, VALID_LOCALES } from '@/lib/i18n';

export default async function AdminDashboardPage() {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get('locale')?.value;
  const locale: Locale = (
    VALID_LOCALES.includes(storedLocale as Locale) ? storedLocale : defaultLocale
  ) as Locale;
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(locale, key, options as Record<string, string>);

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
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.panel')}</h1>
        <p className="text-muted-foreground mt-1">{t('admin.welcome', { name: adminName })}</p>
      </div>

      {/* Estadístiques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        <StatCard title={t('admin.stats.registeredUsers')} value={userCount} />
        <StatCard
          title={t('admin.stats.actionsToday')}
          value={recentLogs.filter((l) => isToday(l.createdAt)).length}
        />
        <StatCard title={t('admin.stats.actionsLast24h')} value={recentLogs.length} />
      </div>

      {/* Navegació */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <AdminNavCard
          href="/admin/users"
          icon={Users}
          title={t('admin.nav.users')}
          description={t('admin.cards.usersDesc')}
        />
        <AdminNavCard
          href="/admin/config"
          icon={Settings}
          title={t('admin.nav.config')}
          description={t('admin.cards.configDesc')}
        />
        <AdminNavCard
          href="/admin/courses"
          icon={BookOpen}
          title={t('admin.nav.courses')}
          description={t('admin.cards.coursesDesc')}
        />
        <AdminNavCard
          href="/admin/audit"
          icon={ClipboardList}
          title={t('admin.nav.audit')}
          description={t('admin.cards.auditDesc')}
        />
      </div>

      {/* Activitat recent */}
      <div>
        <h2 className="text-base font-semibold mb-4">{t('admin.recentActivity')}</h2>
        <div className="rounded-xl border border-border/60 overflow-hidden bg-white/60 dark:bg-slate-900/50 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.table.action')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.table.user')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  {t('admin.table.entity')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.table.date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {log.user
                      ? `${log.user.profile?.firstName ?? ''} ${log.user.profile?.lastName ?? ''}`.trim() ||
                        log.user.email
                      : t('admin.table.system')}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                    {log.entityType ? `${log.entityType}/${log.entityId?.slice(0, 8)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {t('admin.table.noActivity')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/60 dark:bg-slate-900/50 px-5 py-4 shadow-sm">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-semibold mt-1.5 tabular-nums">{value}</p>
    </div>
  );
}

function AdminNavCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border/60 bg-white/60 dark:bg-slate-900/50 px-5 py-4 shadow-sm hover:shadow-md hover:border-border transition-all block group"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
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
