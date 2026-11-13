import { defineConfig, devices } from '@playwright/test'

const PORT = 8790

// The real thing, end to end: the production build served by `wrangler pages
// dev` with a throwaway local D1 and the offline book catalogue.
export default defineConfig({
  testDir: 'e2e',
  // Whole journeys (shelve, annotate, share, visit as a stranger) take a while on phone emulation.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: [
      'rm -rf .wrangler/e2e',
      'pnpm exec vite build',
      'pnpm exec wrangler d1 migrations apply little-alexandria --local --persist-to .wrangler/e2e',
      `pnpm exec wrangler pages dev dist --port ${PORT} --persist-to .wrangler/e2e --binding DEV_LOGIN=1 --binding BOOK_SOURCE=fixture`,
    ].join(' && '),
    url: `http://localhost:${PORT}/api/auth/providers`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
