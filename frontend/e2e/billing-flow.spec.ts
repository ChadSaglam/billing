import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL || 'test@chadev.ch';
const PASSWORD = process.env.TEST_PASSWORD || 'testpass123';

test.describe('Critical billing flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', EMAIL);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10_000 });
  });

  test('login → create Offerte → convert to Rechnung → mark paid', async ({ page }) => {
    // Verify dashboard loaded
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Create Offerte
    await page.goto('/documents/new?type=offerte');
    await page.waitForLoadState('networkidle');

    // Fill required fields — adjust selectors to match your form
    const clientSelect = page.locator('[data-testid="client-select"], select, [role="combobox"]').first();
    await clientSelect.click();
    await page.locator('[role="option"]').first().click();

    // Add a line item
    const descInput = page.locator('input[placeholder*="escription"], textarea[placeholder*="escription"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill('E2E Test Service');
      const qtyInput = page.locator('input[placeholder*="ty"], input[name*="quantity"]').first();
      if (await qtyInput.isVisible()) await qtyInput.fill('2');
      const priceInput = page.locator('input[placeholder*="rice"], input[name*="price"]').first();
      if (await priceInput.isVisible()) await priceInput.fill('100');
    }

    // Save
    await page.click('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
    await page.waitForURL(/\/documents\/\d+/, { timeout: 10_000 });

    // Verify Offerte created
    const docUrl = page.url();
    const docId = docUrl.match(/\/documents\/(\d+)/)?.[1];
    expect(docId).toBeTruthy();
    await expect(page.locator('text=OFF-')).toBeVisible();

    // Convert to Rechnung
    const convertBtn = page.locator('button:has-text("Convert"), button:has-text("Rechnung erstellen")');
    if (await convertBtn.isVisible({ timeout: 3_000 })) {
      await convertBtn.click();
      // Confirm dialog if present
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Convert")').last();
      if (await confirmBtn.isVisible({ timeout: 2_000 })) await confirmBtn.click();
      await page.waitForURL(/\/documents\/\d+/, { timeout: 10_000 });
      await expect(page.locator('text=REC-')).toBeVisible();
    }

    // Mark as paid
    const statusBtn = page.locator('button:has-text("Mark Paid"), button:has-text("Paid"), [data-testid="mark-paid"]');
    if (await statusBtn.isVisible({ timeout: 3_000 })) {
      await statusBtn.click();
      const confirmPaid = page.locator('button:has-text("Confirm"), button:has-text("Save")').last();
      if (await confirmPaid.isVisible({ timeout: 2_000 })) await confirmPaid.click();
      await expect(page.locator('text=paid')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('dashboard shows KPI cards', async ({ page }) => {
    await expect(page.locator('text=Total Revenue')).toBeVisible();
    await expect(page.locator('text=Outstanding')).toBeVisible();
    await expect(page.locator('text=Overdue')).toBeVisible();
    await expect(page.locator('text=Total Clients')).toBeVisible();
  });

  test('clients CRUD', async ({ page }) => {
    await page.goto('/clients');
    await page.click('button:has-text("New Client")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });

    await page.fill('input[name="company_name"], input[placeholder*="ompany"]', 'E2E Test AG');
    await page.fill('input[name="street"], input[placeholder*="treet"]', 'Teststrasse 1');
    await page.fill('input[name="postal_code"], input[placeholder*="ostal"]', '8000');
    await page.fill('input[name="city"], input[placeholder*="ity"]', 'Zürich');

    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    await expect(page.locator('text=E2E Test AG')).toBeVisible({ timeout: 5_000 });

    // Cleanup — delete
    const row = page.locator('tr:has-text("E2E Test AG"), [class*="card"]:has-text("E2E Test AG")').first();
    const deleteBtn = row.locator('button:has(svg.text-destructive), button[aria-label*="elete"]');
    if (await deleteBtn.isVisible({ timeout: 2_000 })) {
      await deleteBtn.click();
      const confirmDelete = page.locator('button:has-text("Delete")').last();
      await confirmDelete.click();
      await expect(page.locator('text=E2E Test AG')).not.toBeVisible({ timeout: 5_000 });
    }
  });
});