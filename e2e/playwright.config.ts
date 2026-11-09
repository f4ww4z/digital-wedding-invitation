import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack (default: `docker compose up` on :8080).
 *   BASE_URL=http://localhost:8080 ADMIN_PASSWORD=... pnpm test:e2e
 * Uses the locally installed Chrome by default (PW_CHANNEL=chromium to use Playwright's).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    channel: process.env.PW_CHANNEL ?? 'chrome',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    locale: 'id-ID',
    trace: 'retain-on-failure',
  },
});
