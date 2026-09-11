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
import { formatCurrency, formatDate, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge, ConfirmDialog, EmptyState, ErrorState, PageSkeleton } from '@/components/shared';
import PreviewPanel from '@/components/PreviewPanel';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: doc, isLoading, isError, error, refetch } = useQuery({
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
    onSuccess: () => { invalidate(); toast({ title: t('docDetail.statusUpdated') }); },
    onError: () => toast({ title: t('docDetail.statusFailed'), variant: 'destructive' }),
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
      toast({ title: t('docDetail.markedPaid') });
      setPaymentOpen(false);
    },
    onError: () => toast({ title: t('docDetail.markPaidFailed'), variant: 'destructive' }),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: t('docDetail.converted') });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => toast({ title: t('docDetail.convertFailed'), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: t('docDetail.deleted') });
      navigate('/documents');
    },
    onError: () => toast({ title: t('docDetail.deleteFailed'), variant: 'destructive' }),
  });

  const emailMutation = useMutation({
    mutationFn: () => sendDocumentEmail(Number(id)),
    onSuccess: (data) => {
      invalidate();
      toast({ title: t('docDetail.emailSent', { recipient: data.recipient }) });
    },
    onError: (err: unknown) => {
      toast({ title: getApiErrorMessage(err, t('docDetail.emailFailed')), variant: 'destructive' });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => generatePortalToken(Number(id)),
    onSuccess: () => {
      invalidate();
      toast({ title: t('docDetail.portalGenerated') });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: t('docDetail.duplicated', { number: newDoc.document_number }) });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => toast({ title: t('docDetail.duplicateFailed'), variant: 'destructive' }),
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
            toast({ title: t('docDetail.emailSent', { recipient: data.recipient }) });
          }).catch(() => toast({ title: t('docDetail.emailFailed'), variant: 'destructive' }));
          break;
        case 'd':
          duplicateDocument(Number(id)).then((newDoc) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
            toast({ title: t('docDetail.duplicated', { number: newDoc.document_number }) });
            navigate(`/documents/${newDoc.id}`);
          }).catch(() => toast({ title: t('docDetail.duplicateFailed'), variant: 'destructive' }));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doc, previewOpen, deleteOpen, convertOpen, paymentOpen, navigate, id, queryClient, invalidate, t]);

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (isError) {
    return <ErrorState error={error} fallback={t('docDetail.loadFailed')} onRetry={() => refetch()} />;
  }

  if (!doc) {
    return (
      <EmptyState
        icon={FileText}
        title={t('docDetail.notFound')}
        description={t('docDetail.notFoundDesc')}
        action={<Button variant="outline" onClick={() => navigate('/documents')}>{t('docDetail.backToDocuments')}</Button>}
      />
    );
  }

  const isOfferte = doc.document_type === 'offerte';
  const isRechnung = doc.document_type === 'rechnung';
  const typeLabel = isRechnung ? t('common.rechnung') : t('common.offerte');
  const portalUrl = doc.portal_token ? `${window.location.origin}/portal/${doc.portal_token}` : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} aria-label={t('docDetail.backToList')}>←</Button>
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
              <p className="text-xs text-muted-foreground uppercase">{t('common.client')}</p>
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
              <p className="text-xs text-muted-foreground uppercase">{t('common.date')}</p>
              <p className="font-medium">{formatDate(doc.date)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t('common.dueDate')}</p>
              <p className="font-medium">{formatDate(doc.due_date)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t('docDetail.payment')}</p>
              <p className="font-medium">{doc.payment_terms_days} {t('common.days')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Info (if paid) */}
      {doc.status === 'paid' && doc.paid_at && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-4 flex items-center gap-6 text-sm">
            <div><span className="text-muted-foreground">{t('docDetail.paidOn')}</span> <strong>{formatDate(doc.paid_at)}</strong></div>
            {doc.payment_method && <div><span className="text-muted-foreground">{t('docDetail.method')}</span> <strong>{doc.payment_method}</strong></div>}
            {doc.payment_reference && <div><span className="text-muted-foreground">{t('docDetail.reference')}</span> <strong>{doc.payment_reference}</strong></div>}
          </CardContent>
        </Card>
      )}

      {/* Recurrence badge */}
      {doc.recurrence && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">🔁 {doc.recurrence}</Badge>
          {doc.next_recurrence_date && <span>{t('docDetail.next')} {formatDate(doc.next_recurrence_date)}</span>}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
          <Mail className="h-4 w-4 mr-1" aria-hidden="true" /> {t('documents.sendEmail')}
        </Button>

        {/* Status buttons */}
        {isOfferte && doc.status === 'sent' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => statusMutation.mutate('accepted')}>
              <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.accept')}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate('rejected')}>
              <XCircle className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.reject')}
            </Button>
          </>
        )}

        {/* Convert Offerte → Rechnung */}
        {isOfferte && (doc.status === 'accepted' || doc.status === 'sent' || doc.status === 'draft') && (
          <Button size="sm" variant="default" onClick={() => setConvertOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.convert')}
          </Button>
        )}

        {/* Mark as paid (with dialog) */}
        {isRechnung && doc.status !== 'paid' && doc.status !== 'cancelled' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setPaymentOpen(true)}>
            <DollarSign className="h-4 w-4 mr-1" aria-hidden="true" /> {t('documents.markPaid')}
          </Button>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.preview')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadDocumentPdf(doc.id, doc.document_number, doc.document_type)}>
          <Download className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.pdf')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-1" aria-hidden="true" /> {t('common.edit')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}>
          <Copy className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.duplicate')}
        </Button>

        {/* Portal link */}
        {portalUrl ? (
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(portalUrl);
            toast({ title: t('docDetail.portalCopied') });
          }}>
            <Copy className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.portalLink')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
            <Link2 className="h-4 w-4 mr-1" aria-hidden="true" /> {t('docDetail.generatePortalLink')}
          </Button>
        )}

        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" /> {t('common.delete')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground hidden md:block">
        {t('docDetail.shortcuts')} <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">E</kbd> {t('common.edit')}
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">P</kbd> {t('docDetail.preview')}
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">S</kbd> {t('documents.sendEmail')}
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] ml-2">D</kbd> {t('docDetail.duplicate')}
      </p>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle>{t('docForm.lineItems')}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm" aria-label={t('docDetail.lineItemsLabel', { number: doc.document_number })}>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="text-left p-2 w-12">{t('portal.pos')}</th>
                <th scope="col" className="text-left p-2">{t('docForm.description')}</th>
                <th scope="col" className="text-right p-2 w-16">{t('docForm.qty')}</th>
                <th scope="col" className="text-left p-2 w-20">{t('docForm.unit')}</th>
                <th scope="col" className="text-right p-2 w-24">{t('docForm.price')}</th>
                <th scope="col" className="text-right p-2 w-16">{t('common.vat')}</th>
                <th scope="col" className="text-right p-2 w-24">{t('common.total')}</th>
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
              <span className="text-muted-foreground">{t('common.subtotal')}</span>
              <span className="tabular-nums">{formatCurrency(doc.subtotal)}</span>
            </div>
            {toNum(doc.discount_percent) > 0 && (
              <div className="flex justify-between w-64 text-red-600">
                <span>{t('common.discount')} ({toNum(doc.discount_percent)}%)</span>
                <span className="tabular-nums">-{formatCurrency(doc.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between w-64">
              <span className="text-muted-foreground">{t('common.vat')}</span>
              <span className="tabular-nums">{formatCurrency(doc.vat_amount)}</span>
            </div>
            <Separator className="w-64 my-1" />
            <div className="flex justify-between w-64 font-bold text-base">
              <span>{t('common.total')}</span>
              <span className="tabular-nums">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {doc.notes && (
        <Card>
          <CardHeader><CardTitle>{t('common.notes')}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.notes}</p></CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('docDetail.deleteTitle')}
        description={t('docDetail.deleteDesc', { number: doc.document_number })}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        variant="destructive"
      />

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={t('docDetail.convertTitle')}
        description={t('docDetail.convertDesc', { number: doc.document_number })}
        confirmLabel={t('docDetail.convert')}
        onConfirm={() => convertMutation.mutate()}
        isPending={convertMutation.isPending}
      />

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('docDetail.markPaidTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paid-at">{t('docDetail.paymentDate')}</Label>
              <Input id="paid-at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div>
              <Label id="payment-method-label">{t('docDetail.paymentMethod')}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger aria-labelledby="payment-method-label"><SelectValue placeholder={t('docDetail.selectMethod')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t('docDetail.bankTransfer')}</SelectItem>
                  <SelectItem value="cash">{t('docDetail.cash')}</SelectItem>
                  <SelectItem value="card">{t('docDetail.card')}</SelectItem>
                  <SelectItem value="twint">TWINT</SelectItem>
                  <SelectItem value="other">{t('docDetail.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-ref">{t('docDetail.referenceOptional')}</Label>
              <Input id="payment-ref" placeholder={t('docDetail.referencePlaceholder')} value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
              {t('docDetail.confirmPayment')}
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
