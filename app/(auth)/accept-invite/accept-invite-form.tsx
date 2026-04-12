'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { type Locale, supportedLocales } from '@/lib/i18n';

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
  const localeParam = searchParams.get('locale');

  const { t, setLocale } = useI18n();

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

  // Apply the locale from the invitation URL before anything else renders.
  useEffect(() => {
    if (!localeParam) return;
    const valid = supportedLocales.find((l) => l.code === localeParam);
    if (valid) setLocale(localeParam as Locale);
  }, [localeParam, setLocale]);

  useEffect(() => {
    if (!token) {
      setTokenError(t('auth.acceptInvite.noToken'));
      setLoading(false);
      return;
    }

    fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setInvitation(data.invitation);
        } else {
          setTokenError(data.error ?? t('auth.acceptInvite.invalidToken'));
        }
      })
      .catch(() => setTokenError(t('auth.acceptInvite.connectionError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError(t('auth.acceptInvite.passwordMinLength'));
      return;
    }
    if (password !== passwordConfirm) {
      setFormError(t('auth.acceptInvite.passwordMismatch'));
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
      if (!res.ok || !data.success) {
        setFormError(data.error ?? t('auth.acceptInvite.activateError'));
        return;
      }

      router.push('/login?activated=1');
    } catch {
      setFormError(t('auth.acceptInvite.connectionError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{t('auth.acceptInvite.verifying')}</p>
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.acceptInvite.invalidTitle')}</CardTitle>
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
        <CardTitle className="text-2xl">{t('auth.acceptInvite.title')}</CardTitle>
        <CardDescription>
          {t('auth.acceptInvite.description', { name: invitation!.firstName })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('auth.acceptInvite.firstName')}</Label>
              <Input value={invitation!.firstName} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.acceptInvite.lastName')}</Label>
              <Input value={invitation!.lastName} readOnly disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('auth.acceptInvite.email')}</Label>
            <Input value={invitation!.email} readOnly disabled type="email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.acceptInvite.password')}</Label>
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
            <Label htmlFor="passwordConfirm">{t('auth.acceptInvite.passwordConfirm')}</Label>
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
            <p className="text-sm text-muted-foreground mb-3">
              {t('auth.acceptInvite.profileOptional')}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="organization">{t('auth.acceptInvite.organization')}</Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder={t('auth.acceptInvite.organizationPlaceholder')}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">{t('auth.acceptInvite.department')}</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('auth.acceptInvite.city')}</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">{t('auth.acceptInvite.jobTitle')}</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={t('auth.acceptInvite.jobTitlePlaceholder')}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('auth.acceptInvite.activating') : t('auth.acceptInvite.activate')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
