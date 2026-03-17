import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UNITS } from './line-item-utils';
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
    <div className={`grid grid-cols-[40px_1fr_70px_100px_100px_90px_40px] gap-0 items-center px-3 py-2 group transition-colors hover:bg-muted/30 ${
      index % 2 === 1 ? 'bg-muted/15' : ''
    }`}>
      <span className="text-xs font-mono text-muted-foreground">{item.position}</span>

      <Input
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder="Service description..."
        className="h-8 text-sm border-0 shadow-none bg-transparent focus-visible:bg-background focus-visible:border focus-visible:shadow-sm rounded-md px-2"
      />

      <Input
        type="number"
        min={0}
        value={item.quantity}
        onChange={(e) => onChange(index, 'quantity', Number(e.target.value))}
        className="h-8 text-sm text-center border-0 shadow-none bg-transparent focus-visible:bg-background focus-visible:border focus-visible:shadow-sm rounded-md px-1 font-mono"
      />

      <Select value={item.unit} onValueChange={(v) => onChange(index, 'unit', v)}>
        <SelectTrigger className="h-8 text-sm border-0 shadow-none bg-transparent focus-visible:bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={0}
        value={item.unit_price}
        onChange={(e) => onChange(index, 'unit_price', Number(e.target.value))}
        className="h-8 text-sm text-right border-0 shadow-none bg-transparent focus-visible:bg-background focus-visible:border focus-visible:shadow-sm rounded-md px-2 font-mono"
      />

      <span className="text-sm font-mono font-medium text-right pr-1">{formatCurrency(item.total_price)}</span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
