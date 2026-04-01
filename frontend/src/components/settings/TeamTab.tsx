import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamUsers, inviteUser, updateUser, removeUser, getMe } from '@/lib/api';
import type { InviteUserPayload } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared';
import { UserPlus, Trash2, Copy, Shield, Pencil, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ROLE_META: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  editor: { label: 'Editor', icon: Pencil, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  viewer: { label: 'Viewer', icon: Eye, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const EMPTY_INVITE: InviteUserPayload = { email: '', full_name: '', role: 'editor' };

interface MutationError {
  response?: { data?: { detail?: string }; status?: number };
}

export function TeamTab() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<InviteUserPayload>(EMPTY_INVITE);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: getMe });
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['team', 'list'],
    queryFn: getTeamUsers,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setTempPassword(res.temp_password);
      toast({ title: `${res.full_name} invited` });
    },
    onError: (err: MutationError) => {
      toast({
        title: 'Invite failed',
        description: err.response?.data?.detail || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: number; role?: string; is_active?: boolean }) =>
      updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast({ title: 'User updated' });
    },
    onError: (err: MutationError) => {
      toast({ title: err.response?.data?.detail || 'Update failed', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setDeleteTarget(null);
      toast({ title: 'User removed' });
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
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage who has access to your billing account</CardDescription>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(EMPTY_INVITE); setTempPassword(null); setInviteOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
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
                        {user.full_name} {isSelf && <span className="text-muted-foreground text-xs">(you)</span>}
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
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={meta.color}>
                        <RoleIcon className="mr-1 h-3 w-3" /> {meta.label}
                      </Badge>
                    )}
                    {isAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogTitle>{tempPassword ? 'User Invited!' : 'Invite Team Member'}</DialogTitle>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Share these credentials with <strong>{form.full_name}</strong>. The temporary password cannot be shown again.
              </p>
              <div className="rounded-lg bg-muted p-4 space-y-2 font-mono text-sm">
                <div>Email: <strong>{form.email}</strong></div>
                <div className="flex items-center gap-2">
                  Password: <strong>{tempPassword}</strong>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast({ title: 'Password copied' });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteOpen(false); setTempPassword(null); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                    <SelectItem value="editor">Editor — create & edit documents</SelectItem>
                    <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove User"
        description="This user will lose access immediately. This cannot be undone."
        confirmLabel="Remove"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </Card>
  );
}