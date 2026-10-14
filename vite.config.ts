/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

type VercelConfig = { headers: { source: string; headers: { key: string; value: string }[] }[] }

// The site-wide headers from vercel.json (CSP and friends), reused by `vite preview`.
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8'),
  ) as VercelConfig
  const siteWide = config.headers.find((entry) => entry.source === '/(.*)')?.headers ?? []
  return Object.fromEntries(siteWide.map(({ key, value }) => [key, value]))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `vite preview` mirrors production: same build, same security headers.
  preview: { headers: productionHeaders() },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/shared/lib/test-setup.ts',
    // Playwright owns tests/e2e; keep Vitest scoped to unit/component tests.
    exclude: ['node_modules/**', 'tests/e2e/**'],
    // Coverage is measured where a bug corrupts data — the pure rules — and enforced
    // there (T-036). UI components are tested for behaviour, not chased for a percentage.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/features/**/domain.ts',
        'src/features/**/engine.ts',
        'src/features/**/xp.ts',
        'src/features/**/party.ts',
        'src/features/**/scheduling.ts',
        'src/features/**/priority.ts',
        'src/features/**/stats.ts',
        'src/features/**/schemas.ts',
        'src/features/**/format.ts',
        'src/features/journey/content/validate.ts',
        'src/shared/lib/supabase-error.ts',
        'src/shared/lib/query-client.ts',
      ],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
})
