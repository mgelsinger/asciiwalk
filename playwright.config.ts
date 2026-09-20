import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  outputDir: `test-results/${process.env.ASCII_RUN || 'general'}`,
  use: {
    baseURL: process.env.ASCII_TEST_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.CI ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {},
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(process.env.ASCII_BRAVE
      ? [{ name: 'brave', use: { launchOptions: { executablePath: process.env.ASCII_BRAVE } } }]
      : []),
    { name: 'chrome', use: { channel: 'chrome' } },
    { name: 'edge', use: { channel: 'msedge' } },
  ],
  reporter: [
    ['list'],
    ['json', { outputFile: `docs/validation/${process.env.ASCII_RUN || 'browser'}-results.json` }],
  ],
});
