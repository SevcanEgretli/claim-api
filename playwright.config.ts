import { defineConfig } from '@playwright/test';
import { baseURL, apiKey } from './config/env';

// API-only test suite: every test uses the `request` fixture, never `page`. No `projects` array is
// defined because there's no browser to configure — no Chromium/Firefox/WebKit binaries are ever
// downloaded or launched, which is also why CI doesn't run `playwright install`.
export default defineConfig({
  testDir: './tests',
  // Every test hits one shared, live, mutable API (no mocks) — parallel workers risk races (e.g. a count
  // fetched by one test changing before its second fetch, because another test created a claim in between).
  // Single worker trades a bit of local speed for determinism.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    trace: 'on-first-retry',
  },
});
