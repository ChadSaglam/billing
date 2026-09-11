import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * R-23: automated accessibility gate. axe-core runs against the login page,
 * the dashboard, the documents list and the document editor and fails on any
 * serious/critical violation. Uses the same fresh-tenant approach as the
 * happy path, but registers through the API so the pages under test start
 * from a realistic, non-empty state.
 */

const API_URL = process.env.E2E_API_URL || 'http://localhost:9100';
const run = Date.now().toString(36);

async function expectNoSeriousViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    // Radix mounts its overlays outside #root; axe sees the whole document.
    .analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
    .join('\n');
  expect(serious, `${name}: ${serious.length} serious/critical axe violations\n${report}`).toEqual([]);
}

let token: string;
let docId: number;

test.beforeAll(async ({ request }) => {
  const reg = await request.post(`${API_URL}/api/auth/register`, {
    data: {
      email: `a11y-${run}@example.com`,
      password: 'A11y-Sup3rSecret!',
      full_name: 'A11y Owner',
      company_name: `A11y Firma ${run}`,
    },
  });
  expect(reg.ok()).toBeTruthy();
  token = (await reg.json()).access_token;
  const auth = { Authorization: `Bearer ${token}` };

  await request.put(`${API_URL}/api/settings`, {
    headers: auth,
    data: { company_name: `A11y Firma ${run}`, street: 'Bahnhofstrasse 1', postal_code: '8001', city: 'Zürich' },
  });
  const done = await request.post(`${API_URL}/api/settings/onboarding-complete`, { headers: auth });
  expect(done.ok()).toBeTruthy();

  const client = await request.post(`${API_URL}/api/clients`, {
    headers: auth,
    data: { customer_number: `A-${run}`, company_name: `Kunde ${run} AG`, street: 'Teststrasse 1', postal_code: '8000', city: 'Zürich', country: 'Schweiz' },
  });
  expect(client.ok()).toBeTruthy();
  const clientId = (await client.json()).id;

  const doc = await request.post(`${API_URL}/api/documents`, {
    headers: auth,
    data: {
      document_type: 'rechnung',
      client_id: clientId,
      date: new Date().toISOString().slice(0, 10),
      payment_terms_days: 30,
      discount_percent: 0,
      status: 'draft',
      line_items: [{ position: 1, description: 'Beratung', quantity: 2, unit: 'Stunde', unit_price: 100, vat_rate: 8.1 }],
    },
  });
  expect(doc.ok()).toBeTruthy();
  docId = (await doc.json()).id;
});

async function signIn(page: Page) {
  await page.addInitScript((t) => {
    localStorage.setItem('auth_token', t);
  }, token);
}

test('login page has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expectNoSeriousViolations(page, 'login');
});

test('dashboard has no serious axe violations and offers a skip link', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await expect(page.getByText('Umsatz total')).toBeVisible();
  await expectNoSeriousViolations(page, 'dashboard');

  // Skip-to-content is the first tab stop and targets <main>.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('documents list has no serious axe violations', async ({ page }) => {
  await signIn(page);
  await page.goto('/documents');
  await expect(page.getByRole('table', { name: 'Dokumentliste' })).toBeVisible();
  await expectNoSeriousViolations(page, 'documents');
});

test('document editor has no serious axe violations', async ({ page }) => {
  await signIn(page);
  await page.goto(`/documents/${docId}/edit`);
  await expect(page.getByPlaceholder('Beschreibung').first()).toHaveValue('Beratung');
  await expectNoSeriousViolations(page, 'document editor');
});

test('language switch flips the UI and <html lang>', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await page.getByTestId('lang-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Total revenue')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Total revenue')).toBeVisible(); // persisted
  await page.getByTestId('lang-de').click();
  await expect(page.getByText('Umsatz total')).toBeVisible();
});

test('dialogs trap focus and close on Escape', async ({ page }) => {
  await signIn(page);
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Neuer Kunde' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Tab a dozen times: focus must never leave the dialog.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      return !!el?.closest('[role="dialog"]');
    });
    expect(inside, `tab ${i + 1} left the dialog`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Neuer Kunde' }).first()).toBeFocused();
});
