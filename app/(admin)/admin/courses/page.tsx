'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/lib/hooks/use-i18n';

interface StageRow {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
  owner: { userId: string; email: string } | null;
}

export default function AdminCoursesPage() {
  const { t, locale } = useI18n();
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stages');
      const data = await res.json();
      setStages(data.stages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/stages?stageId=${encodeURIComponent(deleteId)}`, {
        method: 'DELETE',
      });
      setStages((prev) => prev.filter((s) => s.id !== deleteId));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.courses.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('admin.courses.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('admin.courses.loading')}
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-14 text-center text-muted-foreground text-sm bg-white/60 dark:bg-slate-900/50 shadow-sm">
          {t('admin.courses.empty')}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-white/60 dark:bg-slate-900/50 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.courses.table.name')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Stage ID
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.courses.table.scenes')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  {t('admin.courses.table.owner')}
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                  {t('admin.courses.table.createdAt')}
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr
                  key={stage.id}
                  className="border-t border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={stage.name}>
                    {stage.name || (
                      <span className="text-muted-foreground italic">
                        {t('admin.courses.table.noTitle')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground select-all hidden lg:table-cell">
                    {stage.id}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {stage.sceneCount}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {stage.owner ? (
                      <span title={stage.owner.userId}>{stage.owner.email}</span>
                    ) : (
                      <span className="italic text-muted-foreground/50">
                        {t('admin.courses.table.unknownOwner')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap hidden sm:table-cell">
                    {new Date(stage.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                      onClick={() => setDeleteId(stage.id)}
                      title={t('admin.courses.delete.tooltip')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.courses.delete.title')}</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">{t('admin.courses.delete.confirm')}</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('admin.courses.delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {t('admin.courses.delete.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
