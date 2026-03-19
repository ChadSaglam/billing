import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
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
  return (
    <div className="grid grid-cols-[1fr_70px_100px_110px_80px_100px_40px] gap-2 items-center">
      <Input
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder="Description"
      />
      <Input
        type="number"
        value={item.quantity}
        onChange={(e) => onChange(index, 'quantity', Number(e.target.value))}
        min={0}
        step={0.5}
      />
      <Select value={item.unit} onValueChange={(v) => onChange(index, 'unit', v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
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
        min={0}
        step={0.01}
      />
      <Select
        value={String(item.vat_rate)}
        onValueChange={(v) => onChange(index, 'vat_rate', Number(v))}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
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
      >
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
