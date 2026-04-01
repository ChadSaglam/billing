import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil, CheckCircle, XCircle, DollarSign, Eye, Download,
  ArrowRightLeft, Trash2, FileText, Calendar,
  Clock, CreditCard, Building2, Mail, Link2, Copy,
} from 'lucide-react';
import {
  getDocument, updateDocumentStatus, convertDocument, deleteDocument,
  downloadDocumentPdf, sendDocumentEmail, generatePortalToken,
  updateDocumentStatusWithPayment, duplicateDocument,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge, ConfirmDialog, EmptyState } from '@/components/shared';
import PreviewPanel from '@/components/PreviewPanel';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: queryKeys.documents.detail(id!),
    queryFn: () => getDocument(Number(id)),
    enabled: !!id,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  }, [queryClient, id]);

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateDocumentStatus(Number(id), status),
    onSuccess: () => { invalidate(); toast({ title: 'Status updated' }); },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const paymentMutation = useMutation({
    mutationFn: () => updateDocumentStatusWithPayment(Number(id), {
      status: 'paid',
      paid_at: paidAt,
      payment_method: paymentMethod || undefined,
      payment_reference: paymentRef || undefined,
    }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Marked as paid' });
      setPaymentOpen(false);
    },
    onError: () => toast({ title: 'Failed to mark as paid', variant: 'destructive' }),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Converted to Rechnung' });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => toast({ title: 'Failed to convert', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Document deleted' });
      navigate('/documents');
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const emailMutation = useMutation({
    mutationFn: () => sendDocumentEmail(Number(id)),
    onSuccess: (data) => {
      invalidate();
      toast({ title: `Email sent to ${data.recipient}` });
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      toast({ title: err?.response?.data?.detail || 'Failed to send email', variant: 'destructive' });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => generatePortalToken(Number(id)),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Portal link generated' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: `Duplicated as ${newDoc.document_number}` });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => toast({ title: 'Failed to duplicate', variant: 'destructive' }),
  });

  useEffect(() => {
    if (!doc || previewOpen || deleteOpen || convertOpen || paymentOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key.toLowerCase()) {
        case 'e':
          navigate(`/documents/${doc.id}/edit`);
          break;
        case 'p':
          setPreviewOpen(true);
          break;
        case 's':
          sendDocumentEmail(Number(id)).then((data) => {
            invalidate();
            toast({ title: `Email sent to ${data.recipient}` });
          }).catch(() => toast({ title: 'Failed to send email', variant: 'destructive' }));
          break;
        case 'd':
          duplicateDocument(Number(id)).then((newDoc) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
            toast({ title: `Duplicated as ${newDoc.document_number}` });
            navigate(`/documents/${newDoc.id}`);
          }).catch(() => toast({ title: 'Failed to duplicate', variant: 'destructive' }));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doc, previewOpen, deleteOpen, convertOpen, paymentOpen, navigate, id, queryClient, invalidate]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!doc) return <EmptyState icon={FileText} title="Document not found" />;

  const isOfferte = doc.document_type === 'offerte';
  const isRechnung = doc.document_type === 'rechnung';
  const typeLabel = isRechnung ? 'Rechnung' : 'Offerte';
  const portalUrl = doc.portal_token ? `${window.location.origin}/portal/${doc.portal_token}` : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>←</Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{doc.document_number}</h1>
          <Badge variant="outline">{typeLabel}</Badge>
          <StatusBadge status={doc.status} />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">CLIENT</p>
              {doc.client ? (
                <Link to={`/clients/${doc.client_id}`} className="font-medium hover:underline">
                  {doc.client.company_name}
                </Link>
              ) : <p className="font-medium">-</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">DATE</p>
              <p className="font-medium">{formatDate(doc.date)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">DUE DATE</p>
              <p className="font-medium">{formatDate(doc.due_date)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">PAYMENT</p>
              <p className="font-medium">{doc.payment_terms_days} days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Info (if paid) */}
      {doc.status === 'paid' && doc.paid_at && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-4 flex items-center gap-6 text-sm">
            <div><span className="text-muted-foreground">Paid on:</span> <strong>{formatDate(doc.paid_at)}</strong></div>
            {doc.payment_method && <div><span className="text-muted-foreground">Method:</span> <strong>{doc.payment_method}</strong></div>}
            {doc.payment_reference && <div><span className="text-muted-foreground">Reference:</span> <strong>{doc.payment_reference}</strong></div>}
          </CardContent>
        </Card>
      )}

      {/* Recurrence badge */}
      {doc.recurrence && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">🔁 {doc.recurrence}</Badge>
          {doc.next_recurrence_date && <span>Next: {formatDate(doc.next_recurrence_date)}</span>}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
          <Mail className="h-4 w-4 mr-1" /> Send Email
        </Button>

        {/* Status buttons */}
        {isOfferte && doc.status === 'sent' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => statusMutation.mutate('accepted')}>
              <CheckCircle className="h-4 w-4 mr-1" /> Accept
            </Button>
            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate('rejected')}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </>
        )}

        {/* Convert Offerte → Rechnung */}
        {isOfferte && (doc.status === 'accepted' || doc.status === 'sent' || doc.status === 'draft') && (
          <Button size="sm" variant="default" onClick={() => setConvertOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-1" /> Convert to Rechnung
          </Button>
        )}

        {/* Mark as paid (with dialog) */}
        {isRechnung && doc.status !== 'paid' && doc.status !== 'cancelled' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setPaymentOpen(true)}>
            <DollarSign className="h-4 w-4 mr-1" /> Mark Paid
          </Button>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4 mr-1" /> Vorschau
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadDocumentPdf(doc.id, doc.document_number, doc.document_type)}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}>
          <Copy className="h-4 w-4 mr-1" /> Duplicate
        </Button>

        {/* Portal link */}
        {portalUrl ? (
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(portalUrl);
            toast({ title: 'Portal link copied!' });
          }}>
            <Copy className="h-4 w-4 mr-1" /> Portal Link
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
            <Link2 className="h-4 w-4 mr-1" /> Generate Portal Link
          </Button>
        )}

        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground hidden md:block">
        Shortcuts: <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">E</kbd> Edit
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">P</kbd> Preview
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">S</kbd> Send Email
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">D</kbd> Duplicate
      </p>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-2 w-12">Pos</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2 w-16">Qty</th>
                <th className="text-left p-2 w-20">Unit</th>
                <th className="text-right p-2 w-24">Price</th>
                <th className="text-right p-2 w-16">MwSt</th>
                <th className="text-right p-2 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {doc.line_items.map((item) => (
                <tr key={item.id || item.position} className="border-b last:border-0">
                  <td className="p-2">{item.position}</td>
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-right tabular-nums">{Number(item.quantity).toFixed(2)}</td>
                  <td className="p-2">{item.unit}</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                  <td className="p-2 text-right tabular-nums">{toNum(item.vat_rate)}%</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Separator className="my-4" />

          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between w-64">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(doc.subtotal)}</span>
            </div>
            {toNum(doc.discount_percent) > 0 && (
              <div className="flex justify-between w-64 text-red-600">
                <span>Discount ({toNum(doc.discount_percent)}%)</span>
                <span className="tabular-nums">-{formatCurrency(doc.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between w-64">
              <span className="text-muted-foreground">MwSt 8.1%</span>
              <span className="tabular-nums">{formatCurrency(doc.vat_amount)}</span>
            </div>
            <Separator className="w-64 my-1" />
            <div className="flex justify-between w-64 font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {doc.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.notes}</p></CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description={`Are you sure you want to delete ${doc.document_number}? This cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        variant="destructive"
      />

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title="Convert to Rechnung"
        description={`Convert Offerte ${doc.document_number} to a new Rechnung? The Offerte will be marked as accepted.`}
        onConfirm={() => convertMutation.mutate()}
        isPending={convertMutation.isPending}
      />

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="twint">TWINT</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input placeholder="e.g. transaction ID" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreviewPanel
        documentId={doc.id}
        documentNumber={doc.document_number}
        documentType={doc.document_type}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
