'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Sempre mostrem el missatge de confirmació (anti-enumeració)
      setDone(true);
    } catch {
      // Fins i tot si hi ha error de xarxa, mostrem el missatge genèric
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Comprova el correu</CardTitle>
          <CardDescription>
            Si el correu electrònic és vàlid, rebràs un missatge amb instruccions per canviar la
            contrasenya en els propers minuts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Recorda comprovar la carpeta de correu no desitjat.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Tornar a l&apos;accés
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Recuperar contrasenya</CardTitle>
        <CardDescription>
          Introdueix el teu correu electrònic i t&apos;enviarem un enllaç per canviar la
          contrasenya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correu electrònic</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Enviant...' : 'Enviar instruccions'}
          </Button>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Tornar a l&apos;accés
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
