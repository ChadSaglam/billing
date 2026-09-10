import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Happy path against a real backend (R-22): register a tenant, finish
 * onboarding, create a client, create a two-line invoice and open the PDF
 * preview. Every run registers a fresh tenant, so it needs no seed data
 * and leaves nothing that a later run could collide with.
 */

const API_URL = process.env.E2E_API_URL || 'http://localhost:9100';

const run = Date.now().toString(36);
const tenant = {
  email: `e2e-${run}@example.com`,
  password: 'E2e-Sup3rSecret!',
  fullName: 'E2E Owner',
  companyName: `E2E Firma ${run}`,
};
const clientName = `Kunde ${run} AG`;

/** `FormField` renders `<label>` followed by `<input>` without `htmlFor`. */
function fieldByLabel(scope: Page | Locator, label: string) {
  return scope.locator(`label:text-is("${label}") + input, label:has-text("${label}") + input`).first();
}

test.describe.configure({ mode: 'serial' });

test('register → onboarding → client → invoice with 2 lines → PDF preview', async ({ page }) => {
  // ── Register a tenant through the UI ──
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.locator('#full_name').fill(tenant.fullName);
  await page.locator('#company_name').fill(tenant.companyName);
  await page.locator('#email').fill(tenant.email);
  await page.locator('#password').fill(tenant.password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // A fresh tenant is sent to onboarding first.
  await page.waitForURL('**/onboarding', { timeout: 15_000 });
  await fieldByLabel(page, 'Company Name').fill(tenant.companyName);
  await fieldByLabel(page, 'Street').fill('Bahnhofstrasse 1');
  await fieldByLabel(page, 'PLZ').fill('8001');
  await fieldByLabel(page, 'City').fill('Zürich');
  await fieldByLabel(page, 'IBAN').fill('CH93 0076 2011 6238 5295 7');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByText('Total Revenue')).toBeVisible();

  // ── Create a client ──
  await page.goto('/clients');
  await page.getByRole('button', { name: 'New Client' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await fieldByLabel(dialog, 'Customer Number').fill(`K-${run}`);
  await fieldByLabel(dialog, 'Company Name').fill(clientName);
  await fieldByLabel(dialog, 'Street').fill('Teststrasse 1');
  await fieldByLabel(dialog, 'Postal Code').fill('8000');
  await fieldByLabel(dialog, 'City').fill('Zürich');
  await dialog.getByRole('button', { name: 'Create Client' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(clientName).first()).toBeVisible();

  // ── Create an invoice with two lines ──
  await page.goto('/documents/new?type=rechnung');
  await page.getByRole('combobox').first().click();
  await page.getByPlaceholder('Search clients...').fill(clientName);
  await page.getByRole('option', { name: new RegExp(clientName) }).click();

  // Each line is a grid row: description, quantity, unit, unit price, VAT, total.
  const lineRow = (i: number) => page.getByPlaceholder('Description').nth(i).locator('..');
  const fillLine = async (i: number, description: string, qty: string, price: string) => {
    await lineRow(i).getByPlaceholder('Description').fill(description);
    await lineRow(i).locator('input[type="number"]').nth(0).fill(qty);
    await lineRow(i).locator('input[type="number"]').nth(1).fill(price);
  };

  await fillLine(0, 'Beratung', '2', '100');
  await page.getByRole('button', { name: 'Line' }).click();
  await fillLine(1, 'Reisezeit', '1', '50');

  // 250 net + 8.1 % VAT = 270.25 — the editor previews the server's math.
  await expect(page.getByText('CHF 270.25').first()).toBeVisible();

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.waitForURL(/\/documents\/\d+$/, { timeout: 15_000 });
  const docId = Number(page.url().match(/\/documents\/(\d+)$/)![1]);

  await expect(page.getByText('Beratung')).toBeVisible();
  await expect(page.getByText('Reisezeit')).toBeVisible();
  await expect(page.getByText('CHF 270.25').first()).toBeVisible();

  // ── PDF preview: the browser fetches /preview with the bearer token ──
  const previewResponse = page.waitForResponse(
    (res) => res.url().includes(`/api/documents/${docId}/preview`) && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Vorschau' }).click();
  const preview = await previewResponse;
  expect(preview.status()).toBe(200);
  expect(preview.headers()['content-type']).toContain('application/pdf');
  expect((await preview.body()).subarray(0, 5).toString()).toBe('%PDF-');

  // ── The download endpoint, called directly with the session's token ──
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();
  const pdf = await page.request.get(`${API_URL}/api/documents/${docId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(pdf.headers()['content-disposition']).toContain('Rechnung_');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
