import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 15000,

  expect: { timeout: 8_000 },

  retries: 1,
  workers: 4,

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:4321',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    launchOptions: { slowMo: 100 },
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    // Needed for copy-to-clipboard tests
    permissions: ['clipboard-read', 'clipboard-write'],
    // Lock locale so toLocaleString() formats numbers consistently (e.g. "65,536")
    locale: 'en-US',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
