import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// package.json is "type": "module", so __dirname does not exist here.
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

// The spec and the dev server both talk to this backend. Local default is
// the docker-compose port from .env; CI passes an explicit value.
const apiUrl = process.env.VITE_API_URL || 'http://localhost:9201';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: apiUrl, FRONTEND_PORT: '5173' },
  },
});
