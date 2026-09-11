import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * R-25: the i18n helper is framework-free apart from the `useT()` hook, so
 * it is tested in the plain node environment with a tiny localStorage stub.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

let storage: MemoryStorage;

async function loadI18n() {
  vi.resetModules();
  return import('@/lib/i18n');
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { documentElement: { lang: '' } });
});

describe('t()', () => {
  it('defaults to German', async () => {
    const { t, getLocale } = await loadI18n();
    expect(getLocale()).toBe('de');
    expect(t('nav.clients')).toBe('Kunden');
  });

  it('translates to English after a switch', async () => {
    const { t, setLocale } = await loadI18n();
    setLocale('en');
    expect(t('nav.clients')).toBe('Clients');
  });

  it('accepts an explicit locale without touching the current one', async () => {
    const { t, getLocale } = await loadI18n();
    expect(t('common.cancel', undefined, 'en')).toBe('Cancel');
    expect(getLocale()).toBe('de');
  });

  it('falls back to German when a key is missing in English', async () => {
    const { t, setLocale, dictionaries } = await loadI18n();
    setLocale('en');
    const saved = dictionaries.en['nav.clients'];
    delete dictionaries.en['nav.clients'];
    try {
      expect(t('nav.clients')).toBe('Kunden');
    } finally {
      dictionaries.en['nav.clients'] = saved;
    }
  });

  it('returns the key itself when no dictionary defines it', async () => {
    const { t } = await loadI18n();
    expect(t('does.not.exist' as Parameters<typeof t>[0])).toBe('does.not.exist');
  });

  it('interpolates {placeholders} and leaves unknown ones visible', async () => {
    const { t } = await loadI18n();
    expect(t('common.pageOf', { page: 2, pages: 7 })).toBe('Seite 2 von 7');
    expect(t('documents.selected', {})).toBe('{count} ausgewählt');
  });

  it('maps document statuses and passes unknown ones through', async () => {
    const { statusLabel } = await loadI18n();
    expect(statusLabel('paid')).toBe('Bezahlt');
    expect(statusLabel('paid', 'en')).toBe('Paid');
    expect(statusLabel('weird')).toBe('weird');
  });
});

describe('locale persistence', () => {
  it('writes the choice to localStorage and sets <html lang>', async () => {
    const { setLocale } = await loadI18n();
    setLocale('en');
    expect(storage.getItem('locale')).toBe('en');
    expect((globalThis.document as unknown as { documentElement: { lang: string } }).documentElement.lang).toBe('en');
  });

  it('restores the stored locale on load', async () => {
    storage.setItem('locale', 'en');
    const { getLocale, t } = await loadI18n();
    expect(getLocale()).toBe('en');
    expect(t('common.save')).toBe('Save');
  });

  it('ignores garbage in localStorage and falls back to DE', async () => {
    storage.setItem('locale', 'fr');
    const { getLocale } = await loadI18n();
    expect(getLocale()).toBe('de');
  });

  it('survives a throwing storage (private mode)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    const { getLocale, setLocale, t } = await loadI18n();
    expect(getLocale()).toBe('de');
    expect(() => setLocale('en')).not.toThrow();
    expect(t('common.save')).toBe('Save');
  });
});

describe('switcher store', () => {
  it('notifies subscribers on change and stops after unsubscribe', async () => {
    const { subscribe, setLocale } = await loadI18n();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale('de');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown locales', async () => {
    const { setLocale, getLocale } = await loadI18n();
    setLocale('xx' as unknown as 'de');
    expect(getLocale()).toBe('de');
  });

  it('lists DE first, EN second', async () => {
    const { LOCALES } = await loadI18n();
    expect(LOCALES.map((l) => l.code)).toEqual(['de', 'en']);
  });

  it('keeps the EN dictionary complete', async () => {
    const { missingKeys } = await loadI18n();
    expect(missingKeys('en')).toEqual([]);
  });
});
