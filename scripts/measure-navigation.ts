/**
 * Measures navigation and data loading on the PRODUCTION build (T-034), against the
 * mocked Supabase API from tests/support/mock-supabase.ts — so it is repeatable and
 * never touches the real project. Every API answer is delayed by LATENCY_MS, which
 * makes request waterfalls show up in the timings: "request depth" is how many
 * requests had to happen one after another, (content − shell) ÷ latency.
 *
 * Run with: npm run build && npm run perf:measure
 *
 * Reports, per route: JS downloaded and API requests on a cold load, how long until the
 * page heading (shell) and until the network settles (content), the API requests made
 * when first navigating to it inside the app, and when coming back to it.
 */
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { preview } from 'vite'
import { mockSupabase } from '../tests/support/mock-supabase.ts'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`
const LATENCY_MS = 150

const ROUTES = [
  { path: '/', heading: 'Dashboard' },
  { path: '/tasks', heading: 'Tarefas' },
  { path: '/focus', heading: 'Foco' },
  { path: '/team', heading: 'Equipe' },
  { path: '/journey', heading: 'Jornada' },
  { path: '/settings', heading: 'Configurações' },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
}

function summarize(requests: string[]): string {
  const counts = new Map<string, number>()
  for (const request of requests) counts.set(request, (counts.get(request) ?? 0) + 1)
  return [...counts.entries()]
    .map(([request, count]) => (count > 1 ? `${request} ×${count}` : request))
    .join('; ')
}

async function main() {
  // In-process preview server: closing it below really stops it (a spawned `vite
  // preview` can outlive this script on Windows and silently serve a stale build to the
  // next run).
  const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
  try {
    const browser = await chromium.launch()

    console.log(`Simulated API latency: ${LATENCY_MS} ms per request.\n`)
    console.log('## Cold load (new browser, straight to the URL)\n')
    console.log('| Route | JS (kB) | API requests | Shell (ms) | Content (ms) | Request depth |')
    console.log('| --- | ---: | ---: | ---: | ---: | ---: |')
    const coldDetails: string[] = []

    for (const route of ROUTES) {
      const context = await browser.newContext()
      const page = await context.newPage()
      const requests: string[] = []
      let lastResponseAt = 0
      await mockSupabase(page, {
        latencyMs: LATENCY_MS,
        onRequest: (label) => requests.push(label),
        onResponse: () => {
          lastResponseAt = Date.now()
        },
      })

      const start = Date.now()
      await page.goto(BASE_URL + route.path)
      await page.getByRole('heading', { name: route.heading, level: 1 }).waitFor()
      const shellMs = Date.now() - start
      await settle(page)
      // "Content" = when the last API answer landed, not when the network went idle.
      const contentMs = Math.max(lastResponseAt - start, shellMs)
      const jsBytes = await page.evaluate<number>(
        "performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).reduce((sum, e) => sum + e.decodedBodySize, 0)",
      )

      console.log(
        `| ${route.path} | ${(jsBytes / 1024).toFixed(0)} | ${requests.length} | ${shellMs} | ${contentMs} | ${Math.round((contentMs - shellMs) / LATENCY_MS)} |`,
      )
      coldDetails.push(`- \`${route.path}\`: ${summarize(requests)}`)
      await context.close()
    }
    console.log('\n' + coldDetails.join('\n'))

    console.log('\n## Navigating inside the app (starting on the Dashboard)\n')
    console.log('| Route | First visit: API requests | Coming back: API requests |')
    console.log('| --- | --- | --- |')

    const context = await browser.newContext()
    const page = await context.newPage()
    const requests: string[] = []
    await mockSupabase(page, { latencyMs: LATENCY_MS, onRequest: (label) => requests.push(label) })
    await page.goto(BASE_URL + '/')
    await settle(page)
    const nav = page.getByRole('navigation', { name: 'Principal' })

    for (const route of ROUTES.slice(1)) {
      requests.length = 0
      await nav.getByRole('link', { name: route.heading }).click()
      await page.getByRole('heading', { name: route.heading, level: 1 }).waitFor()
      await settle(page)
      const first = summarize(requests) || 'none'

      await nav.getByRole('link', { name: 'Dashboard' }).click()
      await settle(page)
      requests.length = 0
      await nav.getByRole('link', { name: route.heading }).click()
      await page.getByRole('heading', { name: route.heading, level: 1 }).waitFor()
      await settle(page)
      const back = summarize(requests) || 'none'

      console.log(`| ${route.path} | ${first} | ${back} |`)
      await nav.getByRole('link', { name: 'Dashboard' }).click()
      await settle(page)
    }

    await browser.close()
  } finally {
    await server.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
