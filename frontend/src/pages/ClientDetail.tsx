import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Mail, Phone, MapPin } from "lucide-react";
import { getClient, updateClient, getDocuments } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { CreateClientPayload } from "@/types";
import { formatCurrency, formatDate, toNum } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "@/components/shared";
import { ClientFormDialog, EMPTY_CLIENT } from "@/components/clients/ClientFormDialog";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<CreateClientPayload>(EMPTY_CLIENT);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: queryKeys.clients.detail(id!),
    queryFn: () => getClient(Number(id)),
    enabled: !!id,
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: queryKeys.documents.list({ type: undefined, status: undefined, search: undefined }),
    queryFn: () => getDocuments({ client_id: Number(id) }),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateClientPayload>) => updateClient(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(id!) });
      setEditOpen(false);
      toast({ title: "Client updated successfully" });
    },
    onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
  });

  const openEdit = () => {
    if (!client) return;
    setForm({
      customer_number: client.customer_number,
      company_name: client.company_name,
      contact_person: client.contact_person || "",
      email: client.email || "",
      phone: client.phone || "",
      street: client.street,
      postal_code: client.postal_code,
      city: client.city,
      country: client.country,
      notes: client.notes || "",
    });
    setEditOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  const filterDocs = (type?: string) => {
    if (!documents) return [];
    return type ? documents.filter((d) => d.document_type === type) : documents;
  };

  const totalInvoiced = documents
    ? documents.filter((d) => d.document_type === "rechnung").reduce((s, d) => s + toNum(d.total), 0)
    : 0;
  const totalPaid = documents
    ? documents.filter((d) => d.status === "paid").reduce((s, d) => s + toNum(d.total), 0)
    : 0;
  const totalOutstanding = documents
    ? documents.filter((d) => ["sent", "overdue"].includes(d.status)).reduce((s, d) => s + toNum(d.total), 0)
    : 0;

  const renderDocumentsTable = (type?: string) => {
    const filtered = filterDocs(type);
    if (docsLoading) return <TableSkeleton rows={3} columns={5} />;
    if (filtered.length === 0) return <EmptyState preset="documents" title="No documents found" />;
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
            <TableRow key={doc.id} className="cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>
              <TableCell className="font-medium">{doc.document_number}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">{doc.document_type}</Badge>
              </TableCell>
              <TableCell>{formatDate(doc.date)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(doc.total)}</TableCell>
              <TableCell><StatusBadge status={doc.status} /></TableCell>
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
      <EmptyState
        title="Client not found"
        action={<Button variant="link" onClick={() => navigate("/clients")}>Back to Clients</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.company_name}
        description={`Customer ${client.customer_number}`}
        backButton
        actions={
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Client
          </Button>
        }
      />

      {/* Revenue KPIs */}
      {documents && documents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalInvoiced)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-xl font-bold tabular-nums text-green-600">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold tabular-nums text-orange-600">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Client Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">
                  {client.street}<br />
                  {client.postal_code} {client.city}<br />
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
              <p className="text-sm"><span className="font-medium">Contact </span>{client.contact_person}</p>
            </div>
          )}
          {client.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm"><span className="font-medium">Notes </span>{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Documents</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="offerte">Offerten</TabsTrigger>
              <TabsTrigger value="rechnung">Rechnungen</TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderDocumentsTable()}</TabsContent>
            <TabsContent value="offerte">{renderDocumentsTable("offerte")}</TabsContent>
            <TabsContent value="rechnung">{renderDocumentsTable("rechnung")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editingClient={client}
        form={form}
        onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleSubmit}
        isPending={updateMutation.isPending}
      />
    </div>
  );
}