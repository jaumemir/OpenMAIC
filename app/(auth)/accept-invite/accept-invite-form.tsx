'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InvitationInfo {
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: string;
}

export default function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [city, setCity] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError("No s'ha proporcionat cap token d'invitació.");
      setLoading(false);
      return;
    }

    fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setInvitation(data.invitation);
        } else {
          setTokenError(data.error ?? "Token d'invitació no vàlid o caducat.");
        }
      })
      .catch(() => setTokenError('Error de connexió. Torna-ho a intentar.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError('La contrasenya ha de tenir mínim 8 caràcters.');
      return;
    }
    if (password !== passwordConfirm) {
      setFormError('Les contrasenyes no coincideixen.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          organization: organization.trim() || undefined,
          department: department.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          city: city.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.user) {
        setFormError(data.error ?? 'Error activant el compte. Torna-ho a intentar.');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setFormError('Error de connexió. Torna-ho a intentar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Verificant invitació...</p>
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitació no vàlida</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{tokenError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Completa el teu registre</CardTitle>
        <CardDescription>
          Benvingut/da, {invitation!.firstName}! Configura la contrasenya per activar el teu compte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={invitation!.firstName} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Cognom</Label>
              <Input value={invitation!.lastName} readOnly disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Correu electrònic</Label>
            <Input value={invitation!.email} readOnly disabled type="email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contrasenya (mínim 8 caràcters)</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">Confirma la contrasenya</Label>
            <Input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-3">Informació del perfil (opcional)</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="organization">Organització</Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Universitat, empresa, institució..."
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Departament</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciutat</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">Càrrec</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Professor/a, investigador/a, tècnic/a..."
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Activant compte...' : 'Activar compte'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
