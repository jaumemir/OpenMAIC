'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { type Locale, supportedLocales } from '@/lib/i18n';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const localeParam = searchParams.get('locale');

  const { t, setLocale } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validating, setValidating] = useState(true);

  // Apply the locale from the reset URL before anything else renders.
  useEffect(() => {
    if (!localeParam) return;
    const valid = supportedLocales.find((l) => l.code === localeParam);
    if (valid) setLocale(localeParam as Locale);
  }, [localeParam, setLocale]);

  // Validate the token when the page loads.
  useEffect(() => {
    if (!token) {
      setTokenError(t('auth.resetPassword.noToken'));
      setValidating(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setEmail(data.email ?? '');
        } else if (r.status === 410) {
          setTokenError(t('auth.resetPassword.expired'));
        } else {
          setTokenError(t('auth.resetPassword.invalidOrUsed'));
        }
      })
      .catch(() => {
        setTokenError(t('auth.resetPassword.connectionError'));
      })
      .finally(() => setValidating(false));
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError(t('auth.resetPassword.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError(t('auth.resetPassword.passwordMismatch'));
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
        setTimeout(() => router.push('/login'), 3000);
      } else if (res.status === 410) {
        setTokenError(t('auth.resetPassword.expired'));
      } else {
        setSubmitError(data.error ?? t('auth.resetPassword.changeError'));
      }
    } catch {
      setSubmitError(t('auth.resetPassword.connectionError'));
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('auth.resetPassword.verifying')}
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t('auth.resetPassword.invalidTitle')}</CardTitle>
          <CardDescription>{tokenError}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/forgot-password">
            <Button className="w-full">{t('auth.resetPassword.requestNew')}</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              {t('auth.resetPassword.backToLogin')}
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
          <CardTitle className="text-2xl">{t('auth.resetPassword.doneTitle')}</CardTitle>
          <CardDescription>{t('auth.resetPassword.doneDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">{t('auth.resetPassword.loginNow')}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t('auth.resetPassword.title')}</CardTitle>
        {email && (
          <CardDescription>{t('auth.resetPassword.emailDescription', { email })}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.resetPassword.password')}</Label>
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
            <p className="text-xs text-muted-foreground">{t('auth.resetPassword.passwordHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.resetPassword.confirmPassword')}</Label>
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
              <p className="text-xs text-destructive">{t('auth.resetPassword.mismatchInline')}</p>
            )}
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || (!!confirmPassword && password !== confirmPassword)}
          >
            {loading ? t('auth.resetPassword.saving') : t('auth.resetPassword.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
