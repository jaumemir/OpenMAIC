'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Download, Upload, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ThemeListItem } from '@/lib/types/theme';

export function ThemesSettings() {
  const { t } = useI18n();
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const [themes, setThemes] = useState<ThemeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/themes');
      if (!res.ok) throw new Error('Failed to load');
      setThemes(await res.json());
    } catch {
      toast.error(t('settings.themes.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.themes.confirmDelete'))) return;
    const res = await fetch(`/api/themes/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      toast.success(t('settings.themes.deleted'));
      if (themeId === id) setTheme('sistema');
      await reload();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error ?? t('settings.themes.deleteError'));
    }
  };

  const handleExport = async (id: string) => {
    const res = await fetch(`/api/themes/${id}/export`);
    if (!res.ok) { toast.error(t('settings.themes.exportError')); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme-${id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/themes/import', { method: 'POST', body: formData });
      if (res.ok || res.status === 201) {
        toast.success(t('settings.themes.imported'));
        await reload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? t('settings.themes.importError'));
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('settings.themes.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('settings.themes.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleImport}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {t('settings.themes.upload')}
          </Button>
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">{t('settings.themes.loading')}</p>}

      <div className="space-y-2">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              theme.id === themeId
                ? 'border-primary/50 bg-primary/5'
                : 'border-border bg-background hover:bg-muted/30',
            )}
          >
            {/* Color swatch */}
            <div
              className="w-9 h-9 rounded-md border border-border/50 shrink-0"
              style={{ background: theme.colors.primary }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{theme.name}</span>
                {theme.id === themeId && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                    {t('settings.themes.active')}
                  </span>
                )}
                {theme.builtIn && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> {t('settings.themes.builtIn')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{theme.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {theme.id !== themeId && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
                  onClick={() => setTheme(theme.id)}>
                  {t('settings.themes.activate')}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={() => handleExport(theme.id)}
                title={t('settings.themes.export')}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" size="sm" variant="ghost"
                className={cn('h-7 w-7 p-0', theme.locked || theme.builtIn ? 'opacity-30 cursor-not-allowed' : 'hover:text-destructive')}
                disabled={theme.locked || theme.builtIn}
                onClick={() => handleDelete(theme.id)}
                title={t('settings.themes.delete')}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
