'use client';

import { useState, useEffect } from 'react';
import { Paintbrush } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { ThemeListItem } from '@/lib/types/theme';

export function ThemePopover() {
  const { t } = useI18n();
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const [themes, setThemes] = useState<ThemeListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    fetch('/api/themes')
      .then((r) => r.json())
      .then((data: ThemeListItem[]) => {
        setThemes(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [open]);

  const active = themes.find((th) => th.id === themeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                'border border-transparent hover:border-border hover:bg-muted/50',
                open && 'border-border bg-muted/50',
              )}
            >
              {active ? (
                <span
                  className="w-3 h-3 rounded-full border border-border/50 shrink-0"
                  style={{ background: active.colors.primary }}
                />
              ) : (
                <Paintbrush className="size-3.5" />
              )}
              <span className="max-w-[56px] truncate">{active?.name ?? t('toolbar.theme')}</span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('toolbar.themeHint')}</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-52 p-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-1">
          {t('toolbar.selectTheme')}
        </p>
        {loading && (
          <p className="text-xs text-muted-foreground px-2 py-1">{t('toolbar.loadingThemes')}</p>
        )}
        {error && (
          <p className="text-xs text-destructive px-2 py-1">{t('toolbar.loadThemeError')}</p>
        )}
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => {
              setTheme(theme.id);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
              theme.id === themeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
            )}
          >
            <span
              className="w-4 h-4 rounded-sm border border-border/50 shrink-0"
              style={{ background: theme.colors.primary }}
            />
            <span className="flex-1 truncate font-medium">{theme.name}</span>
            {theme.id === themeId && (
              <span className="text-[9px] bg-primary/15 text-primary px-1 rounded">
                {t('toolbar.activeTheme')}
              </span>
            )}
            {theme.builtIn && <span className="text-[9px] text-muted-foreground">🔒</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
