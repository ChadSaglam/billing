export interface LineItemFormData {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export const UNITS = ['Stunde', 'Stück', 'Pauschal', 'Monat'] as const;

export function emptyLineItem(position: number): LineItemFormData {
  return { position, description: '', quantity: 1, unit: 'Stunde', unit_price: 250, total_price: 250 };
}
