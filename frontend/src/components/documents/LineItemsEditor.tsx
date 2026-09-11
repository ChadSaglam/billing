import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Settings2 } from 'lucide-react';
import { getServices } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, toNum } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { ServiceTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ServiceManager } from '@/components/ServiceManager';
import { LineItemRow } from './LineItemRow';
import { calculateTotals, emptyLineItem, lineTotal } from './line-item-utils';
import type { LineItemFormData } from './line-item-utils';

interface LineItemsEditorProps {
  items: LineItemFormData[];
  onChange: (items: LineItemFormData[]) => void;
  discountPercent: number;
}

export function LineItemsEditor({ items, onChange, discountPercent }: LineItemsEditorProps) {
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);
  const { t } = useT();

  const { data: services } = useQuery({
    queryKey: queryKeys.services.all,
    queryFn: getServices,
  });

  const servicesByCategory = useMemo(() => {
    if (!services) return {};
    return services.reduce<Record<string, ServiceTemplate[]>>((acc, svc) => {
      const cat = svc.category || t('docForm.generalCategory');
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    }, {});
  }, [services, t]);

  const { subtotal, discountAmount, vatByRate, total } = useMemo(
    () => calculateTotals(items, discountPercent),
    [items, discountPercent],
  );

  const handleItemChange = (index: number, field: keyof LineItemFormData, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      item.total_price = lineTotal(item.quantity, item.unit_price);
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
      vat_rate: 8.1,
    }]);
  };

  const removeLine = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 }));
    onChange(updated);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">{t('docForm.lineItems')}</CardTitle>
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => v && addServiceAsLine(v)}>
              <SelectTrigger className="w-[200px] h-8 text-xs" aria-label={t('docForm.addFromCatalog')}>
                <SelectValue placeholder={t('docForm.addFromCatalog')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(servicesByCategory).map(([category, svcs]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {svcs.map((svc) => (
                      <SelectItem key={svc.id} value={String(svc.id)}>
                        <span>{svc.name}</span>
                        <span className="ml-2 text-muted-foreground">
                          {formatCurrency(svc.default_price)}/{svc.unit}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-3 w-3" aria-hidden="true" />{t('docForm.line')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setServiceManagerOpen(true)}>
              <Settings2 className="mr-1 h-3 w-3" aria-hidden="true" />{t('docForm.services')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_70px_100px_110px_80px_100px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>{t('docForm.description')}</span>
            <span>{t('docForm.qty')}</span>
            <span>{t('docForm.unit')}</span>
            <span>{t('docForm.price')}</span>
            <span>{t('common.vat')}</span>
            <span className="text-right">{t('common.total')}</span>
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

          <Separator className="my-3" />

          {/* Totals */}
          <div className="space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('common.subtotal')}</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t('common.discount')} ({discountPercent}%)</span>
                <span className="font-mono">−{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {vatByRate.map(([rate, amt]) => (
              <div key={rate} className="flex justify-between text-muted-foreground">
                <span>{t('common.vat')} {rate}%</span>
                <span className="font-mono">{formatCurrency(amt)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t('common.total')}</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
    </>
  );
}
