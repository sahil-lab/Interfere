import { defineConfig } from '@playwright/test';

const baseURL = process.env.WEB_BASE_URL;
if (!baseURL) {
  throw new Error('WEB_BASE_URL must be explicit for browser tests.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'browser.spec.mjs',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 20000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
  },
});
