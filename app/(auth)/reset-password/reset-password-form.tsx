'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validating, setValidating] = useState(true);

  // Validar el token quan es carrega la pàgina
  useEffect(() => {
    if (!token) {
      setTokenError("L'enllaç no és vàlid.");
      setValidating(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setEmail(data.email ?? '');
        } else if (r.status === 410) {
          setTokenError("L'enllaç ha caducat. Sol·licita'n un de nou.");
        } else {
          setTokenError("L'enllaç no és vàlid o ja ha estat utilitzat.");
        }
      })
      .catch(() => {
        setTokenError('Error de connexió. Torna-ho a intentar.');
      })
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError('La contrasenya ha de tenir mínim 8 caràcters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Les contrasenyes no coincideixen.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        // Redirigir al login després de 3 segons
        setTimeout(() => router.push('/login'), 3000);
      } else if (res.status === 410) {
        setTokenError("L'enllaç ha caducat. Sol·licita'n un de nou.");
      } else {
        setSubmitError(data.error ?? 'Error en canviar la contrasenya.');
      }
    } catch {
      setSubmitError('Error de connexió. Torna-ho a intentar.');
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Verificant l&apos;enllaç...
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Enllaç no vàlid</CardTitle>
          <CardDescription>{tokenError}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/forgot-password">
            <Button className="w-full">Sol·licitar un nou enllaç</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Tornar a l&apos;accés
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Contrasenya canviada</CardTitle>
          <CardDescription>
            La teva contrasenya s&apos;ha actualitzat correctament. Seràs redirigit a l&apos;accés
            en uns moments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">Accedir ara</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Nova contrasenya</CardTitle>
        {email && (
          <CardDescription>
            Canvia la contrasenya de <strong>{email}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova contrasenya</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínim 8 caràcters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contrasenya</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Les contrasenyes no coincideixen.</p>
            )}
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || (!!confirmPassword && password !== confirmPassword)}
          >
            {loading ? 'Desant...' : 'Canviar la contrasenya'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
