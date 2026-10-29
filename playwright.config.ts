import { defineConfig, devices } from '@playwright/test';
import { env, STORAGE_STATE } from './src/config/env';

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { outputFolder: 'allure-results', detail: true, suiteTitle: false }],
    ['./src/reporters/MenuReporter.ts'],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // ---------- API tests ----------
    {
      name: 'api',
      testDir: './tests/Backend',
      use: {
        baseURL: env.apiBaseUrl,
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },

    // ---------- UI tests ----------
    // Logs in once through the UI and saves the session, so other UI tests start already logged in.
    {
      name: 'ui-setup',
      testDir: './tests/Frondend',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: env.uiBaseUrl },
    },
    ...(['chromium'] as const).map((browser) => ({
      name: browser,
      testDir: './tests/Frondend',
      dependencies: ['ui-setup'],
      use: {
        ...devices[{ chromium: 'Desktop Chrome' }[browser]],
        baseURL: env.uiBaseUrl,
        storageState: STORAGE_STATE,
        testIdAttribute: 'data-test',
      },
    })),
  ],
});
