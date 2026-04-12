'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/hooks/use-i18n';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

export default function AdminAuditPage() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (filterAction) params.set('action', filterAction);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);

    try {
      const res = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setTotal(data.pagination.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterFrom, filterTo]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('admin.audit.title')}</h1>

      {/* Filtres */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-4 mb-6 items-end">
        <div className="space-y-1">
          <Label>{t('admin.audit.filter.action')}</Label>
          <Input
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="p.ex. COURSE_GENERATED"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label>{t('admin.audit.filter.from')}</Label>
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label>{t('admin.audit.filter.to')}</Label>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit">{t('admin.audit.filter.apply')}</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFilterAction('');
            setFilterFrom('');
            setFilterTo('');
            setPage(1);
          }}
        >
          {t('admin.audit.filter.clear')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mb-4">
        {t('admin.audit.records', { count: String(total) })}
      </p>

      <div className="rounded-xl border border-border/60 overflow-x-auto bg-white/60 dark:bg-slate-900/50 shadow-sm">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                {t('admin.audit.table.action')}
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                {t('admin.audit.table.user')}
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                {t('admin.audit.table.entity')}
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                {t('admin.audit.table.ip')}
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                {t('admin.audit.table.date')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {t('admin.audit.table.loading')}
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {log.user
                      ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() ||
                        log.user.email
                      : t('admin.audit.table.system')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {log.entityType ? `${log.entityType}/${(log.entityId ?? '').slice(0, 8)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {log.ipAddress ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t('admin.audit.table.noRecords')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginació */}
      <div className="flex gap-2 mt-4 justify-end items-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          {t('admin.audit.pagination.prev')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('admin.audit.pagination.page', { page: String(page) })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page * 50 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('admin.audit.pagination.next')}
        </Button>
      </div>
    </div>
  );
}
