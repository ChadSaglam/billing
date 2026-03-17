import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Settings2 } from 'lucide-react';
import { getServices } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, toNum } from '@/lib/utils';
import type { ServiceTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ServiceManager } from '@/components/ServiceManager';
import { LineItemRow } from './LineItemRow';
import { emptyLineItem } from './line-item-utils';
import type { LineItemFormData } from './line-item-utils';

interface LineItemsEditorProps {
  items: LineItemFormData[];
  onChange: (items: LineItemFormData[]) => void;
  discountPercent: number;
}

export function LineItemsEditor({ items, onChange, discountPercent }: LineItemsEditorProps) {
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);

  const { data: services } = useQuery({
    queryKey: queryKeys.services.all,
    queryFn: getServices,
  });

  const servicesByCategory = useMemo(() => {
    if (!services) return {};
    return services.reduce<Record<string, ServiceTemplate[]>>((acc, svc) => {
      const cat = svc.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    }, {});
  }, [services]);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  const handleItemChange = (index: number, field: keyof LineItemFormData, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      item.total_price = Number(item.quantity) * Number(item.unit_price);
    }
    updated[index] = item;
    onChange(updated);
  };

  const addLine = () => onChange([...items, emptyLineItem(items.length + 1)]);

  const addServiceAsLine = (serviceId: string) => {
    const svc = services?.find((s) => String(s.id) === serviceId);
    if (!svc) return;
    const price = toNum(svc.default_price);
    onChange([...items, {
      position: items.length + 1,
      description: svc.name,
      quantity: 1,
      unit: svc.unit,
      unit_price: price,
      total_price: price,
    }]);
  };

  const removeLine = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 }));
    onChange(updated);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Line Items</CardTitle>
            <div className="flex items-center gap-2">
              <Select value="" onValueChange={(v) => v && addServiceAsLine(v)}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="+ Add from service..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(servicesByCategory).map(([category, svcs]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {svcs.map((svc) => (
                        <SelectItem key={svc.id} value={String(svc.id)}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{svc.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatCurrency(svc.default_price)}/{svc.unit}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />Line
              </Button>

              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setServiceManagerOpen(true)}>
                <Settings2 className="mr-1 h-3 w-3" />Services
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Table header */}
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_70px_100px_100px_90px_40px] gap-0 bg-muted/50 border-b px-3 py-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">#</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Description</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase text-center">Qty</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase text-center">Unit</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase text-right">Price</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase text-right">Total</span>
              <span />
            </div>

            {/* Rows */}
            {items.map((item, index) => (
              <LineItemRow
                key={index}
                item={item}
                index={index}
                canRemove={items.length > 1}
                onChange={handleItemChange}
                onRemove={removeLine}
              />
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 ml-auto w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount ({discountPercent}%)</span>
                <span className="font-mono text-destructive">−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-semibold pt-1">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
    </>
  );
}
