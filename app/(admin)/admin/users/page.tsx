'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserRow {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulari invitació
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url?: string; emailSent?: boolean } | null>(null);
  const [inviteError, setInviteError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteResult(null);
    setInviteLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, firstName: inviteFirstName, lastName: inviteLastName }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteResult({ url: data.invitation.acceptUrl, emailSent: data.invitation.emailSent });
        setInviteEmail(''); setInviteFirstName(''); setInviteLastName('');
        loadUsers();
      } else {
        setInviteError(data.error ?? 'Error creant la invitació.');
      }
    } catch {
      setInviteError('Error de connexió.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleToggle(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  }

  async function handleDelete(userId: string) {
    if (!confirm('Segur que vols esborrar aquest usuari?')) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadUsers();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Gestió d&apos;usuaris</h1>

        {/* Formulari invitació */}
        <Card className="mb-8">
          <CardHeader><CardTitle>Convidar nou usuari</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="inviteFirstName">Nom</Label>
                <Input id="inviteFirstName" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} required disabled={inviteLoading} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inviteLastName">Cognom</Label>
                <Input id="inviteLastName" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} required disabled={inviteLoading} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inviteEmail">Correu electrònic</Label>
                <Input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required disabled={inviteLoading} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={inviteLoading} className="w-full">
                  {inviteLoading ? 'Enviant...' : 'Convidar'}
                </Button>
              </div>
            </form>
            {inviteError && <p className="text-sm text-destructive mt-3">{inviteError}</p>}
            {inviteResult && (
              <div className="mt-3 p-3 bg-muted rounded text-sm">
                {inviteResult.emailSent
                  ? '✓ Invitació enviada per email.'
                  : '⚠ Email no enviat (ACS no configurat). URL de la invitació:'}
                {!inviteResult.emailSent && (
                  <p className="mt-1 break-all text-xs font-mono">{inviteResult.url}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Taula d'usuaris */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Usuari</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estat</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Creat</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregant...</td></tr>
              )}
              {!loading && users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString('ca-ES')}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleRoleToggle(u.id, u.role)}>
                        {u.role === 'admin' ? '↓ user' : '↑ admin'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(u.id)}>
                        Esborra
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sense usuaris</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
