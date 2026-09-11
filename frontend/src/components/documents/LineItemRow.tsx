import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UNITS, VAT_RATES } from './line-item-utils';
import type { LineItemFormData } from './line-item-utils';

interface LineItemRowProps {
  item: LineItemFormData;
  index: number;
  canRemove: boolean;
  onChange: (index: number, field: keyof LineItemFormData, value: string | number) => void;
  onRemove: (index: number) => void;
}

export function LineItemRow({ item, index, canRemove, onChange, onRemove }: LineItemRowProps) {
  const { t } = useT();
  const n = index + 1;
  return (
    <div className="grid grid-cols-[1fr_70px_100px_110px_80px_100px_40px] gap-2 items-center">
      <Input
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder={t('docForm.description')}
        aria-label={`${t('docForm.description')} ${n}`}
      />
      <Input
        type="number"
        value={item.quantity}
        onChange={(e) => onChange(index, 'quantity', Number(e.target.value))}
        aria-label={`${t('docForm.qty')} ${n}`}
        min={0}
        step={0.5}
      />
      <Select value={item.unit} onValueChange={(v) => onChange(index, 'unit', v)}>
        <SelectTrigger aria-label={`${t('docForm.unit')} ${n}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        value={item.unit_price}
        onChange={(e) => onChange(index, 'unit_price', Number(e.target.value))}
        aria-label={`${t('docForm.price')} ${n}`}
        min={0}
        step={0.01}
      />
      <Select
        value={String(item.vat_rate)}
        onValueChange={(v) => onChange(index, 'vat_rate', Number(v))}
      >
        <SelectTrigger aria-label={`${t('common.vat')} ${n}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {VAT_RATES.map((r) => (
            <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-right font-mono text-sm pr-1">
        {formatCurrency(item.total_price)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label={t('docForm.removeLine', { n })}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </Button>
    </div>
  );
}
