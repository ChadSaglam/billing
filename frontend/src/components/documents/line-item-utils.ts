export interface LineItemFormData {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  vat_rate: number;
}

export const UNITS = ['Stunde', 'Stück', 'Pauschal', 'Monat'] as const;

export const VAT_RATES = [
  { value: 8.1, label: '8.1%' },
  { value: 2.6, label: '2.6%' },
  { value: 0, label: '0%' },
] as const;

export function emptyLineItem(position: number): LineItemFormData {
  return { position, description: '', quantity: 1, unit: 'Stunde', unit_price: 250, total_price: 250, vat_rate: 8.1 };
}

export interface LineItemTotals {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  /** [rate, amount] pairs, highest rate first, zero amounts dropped. */
  vatByRate: Array<[number, number]>;
  totalVat: number;
  total: number;
}

export function lineTotal(quantity: number | string, unitPrice: number | string): number {
  return Number(quantity) * Number(unitPrice);
}

/**
 * Preview of the server-side totals (documents.py::_recalc_totals): the
 * discount is spread over every line before VAT, VAT is grouped by rate.
 * Display only — the server recomputes and rounds on save.
 */
export function calculateTotals(items: LineItemFormData[], discountPercent: number): LineItemTotals {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const ratio = subtotal > 0 ? afterDiscount / subtotal : 0;

  const map = new Map<number, number>();
  for (const item of items) {
    const vatAmount = (item.total_price * ratio * item.vat_rate) / 100;
    map.set(item.vat_rate, (map.get(item.vat_rate) || 0) + vatAmount);
  }
  const vatByRate = Array.from(map.entries())
    .filter(([, amt]) => amt > 0)
    .sort(([a], [b]) => b - a);
  const totalVat = vatByRate.reduce((sum, [, amt]) => sum + amt, 0);

  return { subtotal, discountAmount, afterDiscount, vatByRate, totalVat, total: afterDiscount + totalVat };
}
