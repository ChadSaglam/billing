import { defineConfig } from '@playwright/test';

// The e2e stack lives on its own ports (5100 frontend / 9100 API) so it can
// run next to a dev stack on 5000 / 9000 without either colliding. The root
// .env is deliberately NOT loaded here: its VITE_API_URL points at the dev
// API. Override with E2E_API_URL when the API listens elsewhere (CI does).
const E2E_FRONTEND_PORT = process.env.E2E_FRONTEND_PORT || '5100';
const baseURL = `http://localhost:${E2E_FRONTEND_PORT}`;
const apiUrl = process.env.E2E_API_URL || 'http://localhost:9100';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Sandboxes that ship their own Chromium can point here instead of
    // running `playwright install`.
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: `npm run dev -- --port ${E2E_FRONTEND_PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: apiUrl, FRONTEND_PORT: E2E_FRONTEND_PORT },
  },
});
