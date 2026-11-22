import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_BASE_URL runs the suite against an already running server, such as `npm run pages:dev`.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: ['ui.spec.ts', 'designs.spec.ts', 'analytics.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3187',
    trace: 'retain-on-failure',
    launchOptions: { channel: 'chrome' },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'node tests/serve.mjs',
        url: 'http://127.0.0.1:3187/api/health',
        reuseExistingServer: false,
      },
});
