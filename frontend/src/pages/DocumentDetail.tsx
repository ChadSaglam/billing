import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil, CheckCircle, XCircle, DollarSign,
  Download, ArrowRightLeft, Trash2, FileText, ExternalLink,
  Calendar, Clock, CreditCard, Building2, Mail,
} from 'lucide-react';
import {
  getDocument, updateDocumentStatus, convertDocument,
  deleteDocument, downloadDocumentPdf, sendDocumentEmail
} from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AxiosError } from 'axios';
import { formatCurrency, formatDate, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, StatusBadge, ConfirmDialog, EmptyState } from '@/components/shared';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: queryKeys.documents.detail(id!),
    queryFn: () => getDocument(Number(id)),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateDocumentStatus(Number(id), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Status updated' });
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Converted to Rechnung' });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => toast({ title: 'Failed to convert document', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Document deleted' });
      navigate('/documents');
    },
    onError: () => toast({ title: 'Failed to delete document', variant: 'destructive' }),
  });

  const emailMutation = useMutation({
    mutationFn: () => sendDocumentEmail(Number(id)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: `Email sent to ${data.recipient}` });
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      const detail = err?.response?.data?.detail || 'Failed to send email';
      toast({ title: detail, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <EmptyState
        icon={FileText}
        title="Document not found"
        action={<Button variant="link" onClick={() => navigate('/documents')}>Back to Documents</Button>}
      />
    );
  }

  const isOfferte = doc.document_type === 'offerte';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageHeader
          title={doc.document_number}
          backButton
          badge={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-sm">{doc.document_type}</Badge>
              <StatusBadge status={doc.status} />
            </div>
          }
        />
      </div>

      {/* Converted-from banner */}
      {doc.converted_from_id && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border">
          <ExternalLink className="h-4 w-4 shrink-0" />
          <span>Converted from Offerte:</span>
          <Link to={`/documents/${doc.converted_from_id}`} className="text-primary hover:underline font-medium">
            {doc.converted_from?.document_number || `#${doc.converted_from_id}`}
          </Link>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Client</p>
                {doc.client ? (
                  <Link to={`/clients/${doc.client_id}`} className="text-sm font-medium text-primary hover:underline">{doc.client.company_name}</Link>
                ) : <p className="text-sm font-medium">—</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Date</p>
                <p className="text-sm font-medium">{formatDate(doc.date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {doc.due_date && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Due Date</p>
                  <p className="text-sm font-medium">{formatDate(doc.due_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Payment</p>
                <p className="text-sm font-medium">{doc.payment_terms_days} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            {doc.status === 'draft' && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />Edit
              </Button>
            )}

            {/* Send Email — available for draft and sent */}
            {['draft', 'sent'].includes(doc.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => emailMutation.mutate()}
                disabled={emailMutation.isPending || !doc.client?.email}
                title={doc.client?.email ? `Send to ${doc.client.email}` : 'Client has no email'}
              >
                <Mail className="mr-2 h-3.5 w-3.5" />
                {emailMutation.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            )}
            {doc.status === 'sent' && isOfferte && (
              <>
                <Button size="sm" onClick={() => statusMutation.mutate('accepted')} disabled={statusMutation.isPending} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-3.5 w-3.5" />Accept
                </Button>
                <Button variant="destructive" size="sm" onClick={() => statusMutation.mutate('rejected')} disabled={statusMutation.isPending}>
                  <XCircle className="mr-2 h-3.5 w-3.5" />Reject
                </Button>
              </>
            )}
            {doc.status === 'sent' && !isOfferte && (
              <Button size="sm" onClick={() => statusMutation.mutate('paid')} disabled={statusMutation.isPending} className="bg-green-600 hover:bg-green-700">
                <DollarSign className="mr-2 h-3.5 w-3.5" />Mark Paid
              </Button>
            )}
            {doc.status === 'accepted' && isOfferte && (
              <Button size="sm" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
                <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />Convert to Rechnung
              </Button>
            )}

            {/* Spacer pushes right-side buttons */}
            <div className="flex-1" />

            {/* PDF - always visible */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadDocumentPdf(doc.id, doc.document_number, doc.document_type)}
            >
              <Download className="mr-2 h-3.5 w-3.5" />PDF
            </Button>

            {/* Delete - only for drafts */}
            {doc.status === 'draft' && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} disabled={deleteMutation.isPending}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[50px]">Pos</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Description</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-2.5 w-[60px]">Qty</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[80px]">Unit</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-2.5 w-[110px]">Price</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-2.5 w-[110px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.line_items?.map((item, idx) => (
                  <tr key={item.id || item.position} className={idx % 2 === 0 ? '' : 'bg-muted/20'}>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{item.position}</td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 ml-auto w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(doc.subtotal)}</span>
            </div>
            {toNum(doc.discount_percent) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount ({doc.discount_percent}%)</span>
                <span className="font-mono text-destructive">−{formatCurrency(doc.discount_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-semibold pt-1">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {doc.notes && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{doc.notes}</p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description="This will permanently delete this document and all its line items."
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
