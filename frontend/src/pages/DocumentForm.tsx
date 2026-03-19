import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, SendHorizontal } from 'lucide-react';
import { getDocument, createDocument, updateDocument } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { LineItem, CreateDocumentPayload } from '@/types';
import { toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared';
import { DocumentDetailsCard } from '@/components/documents/DocumentDetailsCard';
import { LineItemsEditor } from '@/components/documents/LineItemsEditor';
import { emptyLineItem } from '@/components/documents/line-item-utils';
import type { LineItemFormData } from '@/components/documents/line-item-utils';

export default function DocumentForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [documentType, setDocumentType] = useState<'offerte' | 'rechnung'>(
    (searchParams.get('type') as 'offerte' | 'rechnung') || 'rechnung'
  );
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([emptyLineItem(1)]);

  const { data: existingDoc } = useQuery({
    queryKey: queryKeys.documents.detail(id!),
    queryFn: () => getDocument(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existingDoc) return;
    setDocumentType(existingDoc.document_type);
    setClientId(String(existingDoc.client_id));
    setDate(existingDoc.date);
    setPaymentTermsDays(existingDoc.payment_terms_days);
    setDiscountPercent(toNum(existingDoc.discount_percent));
    setNotes(existingDoc.notes || '');
    setLineItems(
      existingDoc.line_items.map((li: LineItem) => ({
        position: li.position,
        description: li.description,
        quantity: toNum(li.quantity),
        unit: li.unit,
        unit_price: toNum(li.unit_price),
        total_price: toNum(li.total_price),
        vat_rate: toNum(li.vat_rate),
      }))
    );
  }, [existingDoc]);

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: 'Document created successfully' });
      navigate(`/documents/${doc.id}`);
    },
    onError: () => toast({ title: 'Failed to create document', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateDocumentPayload>) => updateDocument(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(id!) });
      toast({ title: 'Document updated successfully' });
      navigate(`/documents/${id}`);
    },
    onError: () => toast({ title: 'Failed to update document', variant: 'destructive' }),
  });

  const handleSubmit = (status: string) => {
    if (!clientId) return toast({ title: 'Please select a client', variant: 'destructive' });
    if (lineItems.length === 0 || lineItems.every((li) => !li.description))
      return toast({ title: 'Please add at least one line item', variant: 'destructive' });

    const payload: CreateDocumentPayload = {
      document_type: documentType,
      client_id: Number(clientId),
      date,
      payment_terms_days: paymentTermsDays,
      discount_percent: discountPercent,
      notes: notes || null,
      status,
      line_items: lineItems.map((li) => ({
        position: li.position,
        description: li.description,
        quantity: Number(li.quantity),
        unit: li.unit,
        unit_price: Number(li.unit_price),
        total_price: Number(li.quantity) * Number(li.unit_price),
        vat_rate: li.vat_rate,
      })),
    };


    if (isEdit) { updateMutation.mutate(payload); } else { createMutation.mutate(payload); }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={isEdit ? 'Edit Document' : 'New Document'}
        backButton
        badge={
          <Badge
            className={`capitalize text-sm px-3 py-1 ${
              documentType === 'offerte'
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
            }`}
            variant="outline"
          >
            {documentType}
          </Badge>
        }
      />

      <DocumentDetailsCard
        documentType={documentType}
        onTypeChange={setDocumentType}
        clientId={clientId}
        onClientChange={setClientId}
        date={date}
        onDateChange={setDate}
        paymentTermsDays={paymentTermsDays}
        onPaymentTermsChange={setPaymentTermsDays}
        discountPercent={discountPercent}
        onDiscountChange={setDiscountPercent}
        isEdit={isEdit}
      />

      <LineItemsEditor items={lineItems} onChange={setLineItems} discountPercent={discountPercent} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            placeholder="Additional notes, payment details, terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-sm border-t">
        <div className="flex justify-end gap-3 max-w-4xl">
          <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSubmit('draft')} disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSubmit('sent')} disabled={isPending}>
            <SendHorizontal className="mr-2 h-4 w-4" />
            {isPending ? 'Saving...' : isEdit ? 'Update & Send' : 'Create & Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
