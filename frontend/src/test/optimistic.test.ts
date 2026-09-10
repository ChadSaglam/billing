import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { optimisticDelete, optimisticUpdate } from '@/lib/optimistic';

interface Row { id: number; name: string; status?: string }

const key = ['rows'] as const;
let qc: QueryClient;
const seed = (): Row[] => [
  { id: 1, name: 'one', status: 'draft' },
  { id: 2, name: 'two', status: 'draft' },
];

beforeEach(() => {
  qc = new QueryClient();
});

describe('optimisticDelete', () => {
  it('removes the row and hands back the previous list for rollback', () => {
    qc.setQueryData<Row[]>(key, seed());
    const { previous } = optimisticDelete<Row>(qc, key, 1);
    expect(qc.getQueryData<Row[]>(key)).toEqual([{ id: 2, name: 'two', status: 'draft' }]);
    expect(previous).toEqual(seed());
  });

  it('restoring `previous` undoes the change exactly', () => {
    qc.setQueryData<Row[]>(key, seed());
    const { previous } = optimisticDelete<Row>(qc, key, 2);
    qc.setQueryData(key, previous);
    expect(qc.getQueryData<Row[]>(key)).toEqual(seed());
  });

  it('is a no-op on a cold cache', () => {
    const { previous } = optimisticDelete<Row>(qc, key, 1);
    expect(previous).toBeUndefined();
    expect(qc.getQueryData(key)).toBeUndefined();
  });

  it('does not mutate the cached array in place', () => {
    const rows = seed();
    qc.setQueryData<Row[]>(key, rows);
    optimisticDelete<Row>(qc, key, 1);
    expect(rows).toHaveLength(2);
  });
});

describe('optimisticUpdate', () => {
  it('merges the patch into the matching row only', () => {
    qc.setQueryData<Row[]>(key, seed());
    const { previous } = optimisticUpdate<Row>(qc, key, 2, { status: 'sent' });
    expect(qc.getQueryData<Row[]>(key)).toEqual([
      { id: 1, name: 'one', status: 'draft' },
      { id: 2, name: 'two', status: 'sent' },
    ]);
    expect(previous).toEqual(seed());
  });

  it('leaves the list untouched when the id is unknown', () => {
    qc.setQueryData<Row[]>(key, seed());
    optimisticUpdate<Row>(qc, key, 99, { status: 'sent' });
    expect(qc.getQueryData<Row[]>(key)).toEqual(seed());
  });

  it('is a no-op on a cold cache', () => {
    expect(optimisticUpdate<Row>(qc, key, 1, { name: 'x' }).previous).toBeUndefined();
  });
});
