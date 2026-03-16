import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Mail, Phone, MapPin } from 'lucide-react';
import { getClient, updateClient, getDocuments } from '@/lib/api';
import type { CreateClientPayload } from '@/types';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<CreateClientPayload | null>(null);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(Number(id)),
    enabled: !!id,
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', { client_id: Number(id) }],
    queryFn: () => getDocuments({ client_id: Number(id) }),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateClientPayload>) => updateClient(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      setEditOpen(false);
      toast({ title: 'Client updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update client', variant: 'destructive' });
    },
  });

  const openEdit = () => {
    if (!client) return;
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
    setEditOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form) updateMutation.mutate(form);
  };

  const filterDocs = (type?: string) => {
    if (!documents) return [];
    if (!type) return documents;
    return documents.filter((d) => d.document_type === type);
  };

  const renderDocumentsTable = (type?: string) => {
    const filtered = filterDocs(type);
    if (docsLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }
    if (filtered.length === 0) {
      return <p className="py-8 text-center text-muted-foreground">No documents found</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((doc) => (
            <TableRow
              key={doc.id}
              className="cursor-pointer"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <TableCell className="font-medium">{doc.document_number}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {doc.document_type}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(doc.date)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(doc.total)}</TableCell>
              <TableCell>
                <Badge className={getStatusColor(doc.status)}>{getStatusLabel(doc.status)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Client not found</p>
        <Button variant="link" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{client.company_name}</h1>
          <p className="text-muted-foreground">Customer #{client.customer_number}</p>
        </div>
        <Button variant="outline" onClick={openEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Client
        </Button>
      </div>

      {/* Client Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">
                  {client.street}
                  <br />
                  {client.postal_code} {client.city}
                  <br />
                  {client.country}
                </p>
              </div>
            </div>
            {client.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{client.email}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                </div>
              </div>
            )}
          </div>
          {client.contact_person && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm">
                <span className="font-medium">Contact: </span>
                {client.contact_person}
              </p>
            </div>
          )}
          {client.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm">
                <span className="font-medium">Notes: </span>
                {client.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="offerte">Offerten</TabsTrigger>
              <TabsTrigger value="rechnung">Rechnungen</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              {renderDocumentsTable()}
            </TabsContent>
            <TabsContent value="offerte">
              {renderDocumentsTable('offerte')}
            </TabsContent>
            <TabsContent value="rechnung">
              {renderDocumentsTable('rechnung')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Number</Label>
                  <Input
                    value={form.customer_number}
                    onChange={(e) => setForm({ ...form, customer_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input
                    value={form.contact_person || ''}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Street</Label>
                <Input
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={form.country || 'Schweiz'}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Update Client'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
