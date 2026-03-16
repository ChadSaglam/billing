import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Zap, Settings2 } from 'lucide-react';
import {
  getDocument,
  getServices,
  createDocument,
  updateDocument,
} from '@/lib/api';
import type { LineItem, CreateDocumentPayload, ServiceTemplate } from '@/types';
import { formatCurrency, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientCombobox } from '@/components/ClientCombobox';
import { ServiceManager } from '@/components/ServiceManager';

interface LineItemForm {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

const emptyLine = (pos: number): LineItemForm => ({
  position: pos,
  description: '',
  quantity: 1,
  unit: 'Stunde',
  unit_price: 250,
  total_price: 250,
});

export default function DocumentForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [documentType, setDocumentType] = useState<'offerte' | 'rechnung'>(
    (searchParams.get('type') as 'offerte' | 'rechnung') || 'rechnung'
  );
  const [clientId, setClientId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemForm[]>([emptyLine(1)]);
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);

  const { data: existingDoc } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(Number(id)),
    enabled: isEdit,
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(),
  });

  // Group services by category
  const servicesByCategory = useMemo(() => {
    if (!services) return {};
    return services.reduce<Record<string, ServiceTemplate[]>>((acc, svc) => {
      const cat = svc.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    }, {});
  }, [services]);

  // Populate form when editing
  useEffect(() => {
    if (existingDoc) {
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
        }))
      );
    }
  }, [existingDoc]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = Number(item.quantity) * Number(item.unit_price);
      }
      updated[index] = item;
      return updated;
    });
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, emptyLine(prev.length + 1)]);
  };

  const addServiceAsLine = (serviceId: string) => {
    if (!services) return;
    const svc = services.find((s) => String(s.id) === serviceId);
    if (!svc) return;

    const price = toNum(svc.default_price);
    const newItem: LineItemForm = {
      position: lineItems.length + 1,
      description: svc.name,
      quantity: 1,
      unit: svc.unit,
      unit_price: price,
      total_price: price,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((item, i) => ({ ...item, position: i + 1 }));
    });
  };

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document created successfully' });
      navigate(`/documents/${doc.id}`);
    },
    onError: () => {
      toast({ title: 'Failed to create document', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateDocumentPayload>) => updateDocument(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      toast({ title: 'Document updated successfully' });
      navigate(`/documents/${id}`);
    },
    onError: () => {
      toast({ title: 'Failed to update document', variant: 'destructive' });
    },
  });

  const handleSubmit = (status: string) => {
    if (!clientId) {
      toast({ title: 'Please select a client', variant: 'destructive' });
      return;
    }
    if (lineItems.length === 0 || lineItems.every((li) => !li.description)) {
      toast({ title: 'Please add at least one line item', variant: 'destructive' });
      return;
    }

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
      })),
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {isEdit ? 'Edit Document' : 'New Document'}
          </h1>
        </div>
        <Badge variant="outline" className="capitalize text-base px-3 py-1">
          {documentType}
        </Badge>
      </div>

      {/* Document Type & Client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as 'offerte' | 'rechnung')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offerte">Offerte</SelectItem>
                    <SelectItem value="rechnung">Rechnung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Client</Label>
              <ClientCombobox value={clientId} onChange={setClientId} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">Line Items</CardTitle>
            <div className="flex items-center gap-2">
              {/* Quick-add from service catalog */}
              <Select
                value=""
                onValueChange={(v) => {
                  if (v) addServiceAsLine(v);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span>Add service...</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(servicesByCategory).map(([category, svcs]) => (
                    <SelectGroup key={category}>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {category}
                      </SelectLabel>
                      {svcs.map((svc) => (
                        <SelectItem key={svc.id} value={String(svc.id)}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{svc.name}</span>
                            <span className="text-xs text-muted-foreground font-mono ml-2">
                              {formatCurrency(svc.default_price)}/{svc.unit}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setServiceManagerOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Manage Services
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-1">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>
            <Separator />

            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-1 flex items-center h-10 text-sm text-muted-foreground font-mono">
                  {item.position}
                </div>
                <div className="col-span-12 md:col-span-4">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Select
                    value={item.unit}
                    onValueChange={(v) => updateLineItem(index, 'unit', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stunde">Stunde</SelectItem>
                      <SelectItem value="Stück">Stück</SelectItem>
                      <SelectItem value="Pauschal">Pauschal</SelectItem>
                      <SelectItem value="Monat">Monat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-10 md:col-span-1 flex items-center h-10 justify-end text-sm font-mono">
                  {formatCurrency(item.total_price)}
                </div>
                <div className="col-span-2 md:col-span-1 flex items-center h-10 justify-end">
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <Separator className="my-6" />
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-64 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between w-64 text-sm">
                <span className="text-muted-foreground">Discount ({discountPercent}%)</span>
                <span className="font-mono text-destructive">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <Separator className="w-64" />
            <div className="flex justify-between w-64 text-base font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSubmit('draft')}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button onClick={() => handleSubmit('sent')} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save & Send'}
        </Button>
      </div>

      <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
    </div>
  );
}
