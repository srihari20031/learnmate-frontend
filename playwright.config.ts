import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the LearnMate chat frontend.
 *
 * The FastAPI backend (NEXT_PUBLIC_API_URL, default http://localhost:8000) is
 * NOT required to run these tests — every backend call is intercepted with
 * `page.route()` (see tests/helpers/mock-api.ts), so the suite is deterministic
 * and runs against a freshly started `next dev` server.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  // Generous timeouts so the dev server's first on-demand route compilation
  // (Turbopack compiles each route the first time it's hit) doesn't cause
  // flaky timeouts when many parallel workers hit cold routes at once.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      // Only the explicitly mobile-tagged specs run on a phone viewport.
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
