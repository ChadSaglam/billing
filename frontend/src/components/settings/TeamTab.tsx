import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamUsers, inviteUser, updateUser, removeUser, getMe } from '@/lib/api';
import type { InviteUserPayload } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/errors';
import { useT, type TKey } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog, EmptyState, ErrorState, PageSkeleton } from '@/components/shared';
import { UserPlus, Trash2, Copy, Shield, Pencil, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ROLE_META: Record<string, { label: TKey; icon: typeof Shield; color: string }> = {
  admin: { label: 'team.admin', icon: Shield, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  editor: { label: 'team.editor', icon: Pencil, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  viewer: { label: 'team.viewer', icon: Eye, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const EMPTY_INVITE: InviteUserPayload = { email: '', full_name: '', role: 'editor' };

export function TeamTab() {
  const queryClient = useQueryClient();
  const { t } = useT();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<InviteUserPayload>(EMPTY_INVITE);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: getMe });
  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['team', 'list'],
    queryFn: getTeamUsers,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setTempPassword(res.temp_password);
      toast({ title: t('team.invited', { name: res.full_name }) });
    },
    onError: (err: unknown) => {
      toast({
        title: t('team.inviteFailed'),
        description: getApiErrorMessage(err, t('team.unknownError')),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: number; role?: string; is_active?: boolean }) =>
      updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast({ title: t('team.userUpdated') });
    },
    onError: (err: unknown) => {
      toast({ title: getApiErrorMessage(err, t('team.updateFailed')), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setDeleteTarget(null);
      toast({ title: t('team.userRemoved') });
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(form);
  };

  const isAdmin = me?.role === 'admin';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('team.title')}</CardTitle>
          <CardDescription>{t('team.desc')}</CardDescription>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(EMPTY_INVITE); setTempPassword(null); setInviteOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" /> {t('team.invite')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PageSkeleton variant="cards" rows={3} header={false} />
        ) : isError ? (
          <ErrorState variant="inline" error={error} fallback={t('team.loadFailed')} onRetry={() => refetch()} />
        ) : users.length === 0 ? (
          <EmptyState preset="clients" title={t('team.none')} description={t('team.noneDesc')} />
        ) : (
          <div className="space-y-2">
            {users.map((user) => {
              const meta = ROLE_META[user.role] || ROLE_META.viewer;
              const RoleIcon = meta.icon;
              const isSelf = user.id === me?.id;
              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    !user.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {user.full_name} {isSelf && <span className="text-muted-foreground text-xs">{t('team.you')}</span>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && !isSelf ? (
                      <Select
                        value={user.role}
                        onValueChange={(role) => updateMutation.mutate({ id: user.id, role })}
                      >
                        <SelectTrigger className="w-28 h-8" aria-label={t('team.roleFor', { name: user.full_name })}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t('team.admin')}</SelectItem>
                          <SelectItem value="editor">{t('team.editor')}</SelectItem>
                          <SelectItem value="viewer">{t('team.viewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={meta.color}>
                        <RoleIcon className="mr-1 h-3 w-3" aria-hidden="true" /> {t(meta.label)}
                      </Badge>
                    )}
                    {isAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(user.id)}
                        aria-label={t('team.removeUserNamed', { name: user.full_name })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setTempPassword(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tempPassword ? t('team.userInvited') : t('team.inviteMember')}</DialogTitle>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('team.shareCredentials', { name: form.full_name })}
              </p>
              <div className="rounded-lg bg-muted p-4 space-y-2 font-mono text-sm">
                <div>{t('field.email')}: <strong>{form.email}</strong></div>
                <div className="flex items-center gap-2">
                  {t('auth.password')}: <strong>{tempPassword}</strong>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast({ title: t('team.passwordCopied') });
                    }}
                    aria-label={t('team.copyPassword')}
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteOpen(false); setTempPassword(null); }}>{t('common.done')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label htmlFor="invite-full-name" className="text-sm font-medium">{t('auth.fullName')}</label>
                <Input
                  id="invite-full-name"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label htmlFor="invite-email" className="text-sm font-medium">{t('field.email')}</label>
                <Input
                  id="invite-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label id="invite-role-label" className="text-sm font-medium">{t('team.role')}</label>
                <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger aria-labelledby="invite-role-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('team.adminDesc')}</SelectItem>
                    <SelectItem value="editor">{t('team.editorDesc')}</SelectItem>
                    <SelectItem value="viewer">{t('team.viewerDesc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? t('team.inviting') : t('team.sendInvite')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('team.removeUser')}
        description={t('team.removeDesc')}
        confirmLabel={t('team.remove')}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </Card>
  );
}
