'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function AdminConfigPage() {
  const { t } = useI18n();
  const [allowedModels, setAllowedModels] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const val = data.config.allowedModels;
          setAllowedModels(val === null ? '' : Array.isArray(val) ? val.join(', ') : '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const trimmed = allowedModels.trim();
    // Buit = null (tots permesos); sinó, array de strings
    const value =
      trimmed === ''
        ? null
        : trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedModels: value }),
      });
      const data = await res.json();
      setMessage(
        data.success ? t('admin.config.saved') : (data.error ?? t('admin.config.errorSaving')),
      );
    } catch {
      setMessage(t('admin.config.errorConnection'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">{t('admin.config.title')}</h1>

      <Card className="rounded-2xl border-border/60 bg-white/60 dark:bg-slate-900/50 shadow-sm">
        <CardHeader>
          <CardTitle>{t('admin.config.allowedModels.title')}</CardTitle>
          <CardDescription>
            {t('admin.config.allowedModels.desc')} Format:{' '}
            <code className="text-xs bg-muted px-1 rounded">
              openai:gpt-4o, google:gemini-2.5-flash
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('admin.config.loading')}</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                value={allowedModels}
                onChange={(e) => setAllowedModels(e.target.value)}
                placeholder={t('admin.config.allowedModels.placeholder')}
                disabled={saving}
              />
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={saving}>
                  {saving ? t('admin.config.saving') : t('admin.config.save')}
                </Button>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
