import { defineConfig, devices } from '@playwright/test'

const DEV_URL = 'http://localhost:4173'
const PRODUCTION_BUILD_URL = 'http://localhost:4175'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: DEV_URL },
    },
    // The same essential flows against the PRODUCTION build served with the production
    // security headers (see vercel.json / vite.config.ts): what ships is what was tested,
    // including code-splitting and the Content-Security-Policy.
    {
      name: 'production-build',
      testMatch: /essential-flows\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: PRODUCTION_BUILD_URL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 4173',
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    {
      command: 'npm run build && npx vite preview --port 4175 --strictPort',
      url: PRODUCTION_BUILD_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
})
