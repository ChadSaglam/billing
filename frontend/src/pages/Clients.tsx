import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Client, CreateClientPayload } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { optimisticDelete } from "@/lib/optimistic";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader, EmptyState, TableSkeleton, ConfirmDialog } from '@/components/shared';
import { ClientFormDialog, EMPTY_CLIENT } from '@/components/clients/ClientFormDialog';

export default function Clients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<CreateClientPayload>(EMPTY_CLIENT);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: queryKeys.clients.list(search || undefined),
    queryFn: () => getClients(search || undefined),
  });

  const invalidateClients = () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });

 const createMutation = useMutation({
  mutationFn: createClient,
  onSuccess: () => { invalidateClients(); setDialogOpen(false); toast({ title: 'Client created successfully' }); },
});

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateClientPayload> }) => updateClient(id, payload),
    onSuccess: () => { invalidateClients(); setDialogOpen(false); toast({ title: 'Client updated successfully' }); },
    onError: () => toast({ title: 'Failed to update client', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.all });
      return optimisticDelete<Client>(queryClient, queryKeys.clients.list(search || undefined), id);
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.clients.list(search || undefined), context.previous);
      }
      toast({ title: "Failed to delete client", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      setDeleteTarget(null);
    },
    onSuccess: () => toast({ title: "Client deleted" }),
  });

  const openCreate = () => { setEditingClient(null); setForm(EMPTY_CLIENT); setDialogOpen(true); };

  const openEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setForm({
      customer_number: client.customer_number,
      company_name: client.company_name,
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      street: client.street,
      postal_code: client.postal_code,
      city: client.city,
      country: client.country,
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const updateField = (field: keyof CreateClientPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage your client database"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />New Client
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : clients && clients.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Nr</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                <TableCell className="font-mono">{client.customer_number}</TableCell>
                <TableCell className="font-medium">{client.company_name}</TableCell>
                <TableCell>{client.contact_person || '-'}</TableCell>
                <TableCell>{client.city}</TableCell>
                <TableCell>{client.email || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={(e) => openEdit(client, e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(client.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={Users}
          title="No clients found"
          description="Add your first client to get started"
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Client</Button>}
        />
      )}

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingClient={editingClient}
        form={form}
        onFieldChange={updateField}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Client"
        description="This will permanently delete this client and cannot be undone."
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}
