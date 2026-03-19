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
