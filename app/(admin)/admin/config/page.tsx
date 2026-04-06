'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminConfigPage() {
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
    const value = trimmed === '' ? null : trimmed.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedModels: value }),
      });
      const data = await res.json();
      setMessage(data.success ? '✓ Configuració guardada.' : data.error ?? 'Error desant.');
    } catch {
      setMessage('Error de connexió.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Configuració global</h1>

        <Card>
          <CardHeader>
            <CardTitle>Models permesos</CardTitle>
            <CardDescription>
              Especifica quins models LLM poden usar els usuaris. Deixa buit per permetre tots.
              Format: <code className="text-xs bg-muted px-1 rounded">openai:gpt-4o, google:gemini-2.5-flash</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Carregant...</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  value={allowedModels}
                  onChange={(e) => setAllowedModels(e.target.value)}
                  placeholder="Buit = tots els models permesos"
                  disabled={saving}
                />
                <div className="flex items-center gap-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Desant...' : 'Guardar'}
                  </Button>
                  {message && <p className="text-sm text-muted-foreground">{message}</p>}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
