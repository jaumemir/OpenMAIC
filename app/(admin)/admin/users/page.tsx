'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/hooks/use-i18n';

interface UserRow {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  department: string | null;
  jobTitle: string | null;
  city: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminUsersPage() {
  const { t, locale } = useI18n();

  const STATUS_LABELS: Record<string, string> = {
    active: t('admin.users.status.active'),
    pending: t('admin.users.status.pending'),
    inactive: t('admin.users.status.inactive'),
  };

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulari invitació
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url?: string; emailSent?: boolean } | null>(
    null,
  );
  const [inviteError, setInviteError] = useState('');

  // Diàleg d'edició
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserRow>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteResult(null);
    setInviteLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          firstName: inviteFirstName,
          lastName: inviteLastName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteResult({ url: data.invitation.acceptUrl, emailSent: data.invitation.emailSent });
        setInviteEmail('');
        setInviteFirstName('');
        setInviteLastName('');
        loadUsers();
      } else {
        setInviteError(data.error ?? t('admin.users.invite.errorCreating'));
      }
    } catch {
      setInviteError(t('admin.users.invite.errorConnection'));
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

  async function handleToggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    loadUsers();
  }

  async function handleDelete(userId: string) {
    if (!confirm(t('admin.users.confirmDelete'))) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadUsers();
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      organization: u.organization ?? '',
      department: u.department ?? '',
      jobTitle: u.jobTitle ?? '',
      city: u.city ?? '',
    });
    setEditError('');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditUser(null);
        loadUsers();
      } else {
        setEditError(data.error ?? t('admin.users.edit.errorSaving'));
      }
    } catch {
      setEditError(t('admin.users.invite.errorConnection'));
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">{t('admin.users.title')}</h1>

      {/* Formulari invitació */}
      <Card className="mb-8 rounded-2xl border-border/60 bg-white/60 dark:bg-slate-900/50 shadow-sm">
        <CardHeader>
          <CardTitle>{t('admin.users.invite.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="inviteFirstName">{t('admin.users.invite.firstName')}</Label>
              <Input
                id="inviteFirstName"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                required
                disabled={inviteLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inviteLastName">{t('admin.users.invite.lastName')}</Label>
              <Input
                id="inviteLastName"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                required
                disabled={inviteLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inviteEmail">{t('admin.users.invite.email')}</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={inviteLoading}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviteLoading} className="w-full">
                {inviteLoading ? t('admin.users.invite.sending') : t('admin.users.invite.submit')}
              </Button>
            </div>
          </form>
          {inviteError && <p className="text-sm text-destructive mt-3">{inviteError}</p>}
          {inviteResult && (
            <div className="mt-3 p-3 bg-muted rounded text-sm">
              {inviteResult.emailSent
                ? t('admin.users.invite.emailSent')
                : t('admin.users.invite.emailNotSent')}
              {!inviteResult.emailSent && (
                <p className="mt-1 break-all text-xs font-mono">{inviteResult.url}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Taula d'usuaris */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-white/60 dark:bg-slate-900/50 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                {t('admin.users.table.user')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                {t('admin.users.table.email')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                {t('admin.users.table.role')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                {t('admin.users.table.status')}
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                {t('admin.users.table.created')}
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t('admin.users.table.loading')}
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-t border-border/40 transition-colors ${u.status === 'inactive' ? 'opacity-60 bg-muted/30' : 'hover:bg-muted/20'}`}
                >
                  <td className="px-4 py-2 font-medium">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : '—'}
                    {u.organization && (
                      <span className="ml-1 text-xs text-muted-foreground">· {u.organization}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status] ?? ''}`}
                    >
                      {STATUS_LABELS[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        {t('admin.users.actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRoleToggle(u.id, u.role)}
                      >
                        {u.role === 'admin' ? '↓ user' : '↑ admin'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          u.status === 'inactive'
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-orange-600 hover:text-orange-700'
                        }
                        onClick={() => handleToggleStatus(u.id, u.status)}
                      >
                        {u.status === 'inactive'
                          ? t('admin.users.actions.enable')
                          : t('admin.users.actions.disable')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(u.id)}
                      >
                        {t('admin.users.actions.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t('admin.users.table.noUsers')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Diàleg d'edició d'usuari */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.users.edit.title')}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditSave} className="space-y-4">
              {/* Email (no editable) */}
              <div className="space-y-1">
                <Label>{t('admin.users.invite.email')}</Label>
                <Input value={editUser.email} disabled className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('admin.users.edit.emailNote')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="editFirstName">{t('admin.users.edit.firstName')}</Label>
                  <Input
                    id="editFirstName"
                    value={editForm.firstName ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    disabled={editLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLastName">{t('admin.users.edit.lastName')}</Label>
                  <Input
                    id="editLastName"
                    value={editForm.lastName ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    disabled={editLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="editOrg">{t('admin.users.edit.org')}</Label>
                <Input
                  id="editOrg"
                  value={editForm.organization ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, organization: e.target.value }))}
                  disabled={editLoading}
                  placeholder={t('admin.users.edit.optional')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="editDept">{t('admin.users.edit.dept')}</Label>
                  <Input
                    id="editDept"
                    value={editForm.department ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                    disabled={editLoading}
                    placeholder={t('admin.users.edit.optional')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editJob">{t('admin.users.edit.job')}</Label>
                  <Input
                    id="editJob"
                    value={editForm.jobTitle ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    disabled={editLoading}
                    placeholder={t('admin.users.edit.optional')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="editCity">{t('admin.users.edit.city')}</Label>
                <Input
                  id="editCity"
                  value={editForm.city ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  disabled={editLoading}
                  placeholder={t('admin.users.edit.optional')}
                />
              </div>

              {editError && <p className="text-sm text-destructive">{editError}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditUser(null)}
                  disabled={editLoading}
                >
                  {t('admin.users.edit.cancel')}
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? t('admin.users.edit.saving') : t('admin.users.edit.save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
