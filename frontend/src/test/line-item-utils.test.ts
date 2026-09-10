import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  emptyLineItem,
  lineTotal,
  type LineItemFormData,
} from '@/components/documents/line-item-utils';

const item = (total_price: number, vat_rate = 8.1, position = 1): LineItemFormData => ({
  position,
  description: 'Pos',
  quantity: 1,
  unit: 'Stunde',
  unit_price: total_price,
  total_price,
  vat_rate,
});

describe('lineTotal', () => {
  it('multiplies quantity and price, accepting the strings an input emits', () => {
    expect(lineTotal(2, 250)).toBe(500);
    expect(lineTotal('1.5', '100')).toBe(150);
    expect(lineTotal('', 100)).toBe(0);
  });
});

describe('emptyLineItem', () => {
  it('starts as one hour at the default rate with a consistent total', () => {
    const li = emptyLineItem(3);
    expect(li.position).toBe(3);
    expect(li.total_price).toBe(lineTotal(li.quantity, li.unit_price));
    expect(li.vat_rate).toBe(8.1);
  });
});

describe('calculateTotals', () => {
  it('returns zeros for an empty document', () => {
    expect(calculateTotals([], 10)).toEqual({
      subtotal: 0, discountAmount: 0, afterDiscount: 0, vatByRate: [], totalVat: 0, total: 0,
    });
  });

  it('groups VAT by rate, highest first, and drops the 0 % group', () => {
    const t = calculateTotals([item(100, 2.6, 1), item(100, 8.1, 2), item(100, 0, 3)], 0);
    expect(t.subtotal).toBe(300);
    expect(t.vatByRate.map(([rate]) => rate)).toEqual([8.1, 2.6]);
    expect(t.vatByRate[0][1]).toBeCloseTo(8.1, 10);
    expect(t.vatByRate[1][1]).toBeCloseTo(2.6, 10);
    expect(t.total).toBeCloseTo(310.7, 10);
  });

  it('spreads the discount over every line before VAT (mirrors the server)', () => {
    const t = calculateTotals([item(100, 8.1), item(100, 2.6, 2)], 10);
    expect(t.discountAmount).toBe(20);
    expect(t.afterDiscount).toBe(180);
    // 90 × 8.1 % + 90 × 2.6 %
    expect(t.totalVat).toBeCloseTo(7.29 + 2.34, 10);
    expect(t.total).toBeCloseTo(189.63, 10);
  });

  it('merges lines that share a rate', () => {
    const t = calculateTotals([item(10, 8.1, 1), item(20, 8.1, 2)], 0);
    expect(t.vatByRate).toHaveLength(1);
    expect(t.vatByRate[0][1]).toBeCloseTo(2.43, 10);
  });

  it('a 100 % discount leaves no VAT and a zero total', () => {
    const t = calculateTotals([item(100)], 100);
    expect(t.afterDiscount).toBe(0);
    expect(t.vatByRate).toEqual([]);
    expect(t.total).toBe(0);
  });
});
