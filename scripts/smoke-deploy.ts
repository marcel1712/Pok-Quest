/**
 * Post-deploy smoke test (T-039): opens a DEPLOYED PokéQuest in a real browser and checks
 * that it is actually usable — not a build check, a "did the deploy work" check.
 *
 *   npm run smoke -- https://your-app.vercel.app
 *
 * Always checked (no account needed, nothing is written anywhere):
 *   - a deep link (/tasks) is served by the app, not a 404, and lands on the login form;
 *   - the security headers from vercel.json are present, hashed assets are cached;
 *   - the page loads with no console errors and no Content-Security-Policy violations;
 *   - the app reaches the real Supabase project: a wrong password is refused by it.
 *
 * With SMOKE_EMAIL and SMOKE_PASSWORD set, it also signs in and READS every page:
 *   SMOKE_EMAIL=you@example.com SMOKE_PASSWORD=... npm run smoke -- https://your-app.vercel.app
 * It creates no task and starts no session. (Opening Foco asks the server for the
 * current encounter, exactly as using the app does.) The credentials are only typed
 * into the deployed login form; they are never printed or stored.
 */
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'

const target = process.argv[2]?.replace(/\/$/, '')
if (!target || !/^https?:\/\//.test(target)) {
  console.error('Usage: npm run smoke -- https://your-app.vercel.app')
  process.exit(2)
}
const isLocal = /\/\/(localhost|127\.0\.0\.1)/.test(target)

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}
function skip(name: string, why: string) {
  console.log(`SKIP  ${name}  (${why})`)
}

const PAGES = [
  { link: 'Tarefas', heading: 'Tarefas' },
  { link: 'Foco', heading: 'Foco' },
  { link: 'Equipe', heading: 'Equipe' },
  { link: 'Jornada', heading: 'Jornada' },
  { link: 'Histórico', heading: 'Histórico' },
  { link: 'Configurações', heading: 'Configurações' },
]

async function headers() {
  const response = await fetch(`${target}/tasks`)
  check('deep link /tasks is served by the app', response.status === 200, `HTTP ${response.status}`)

  const csp = response.headers.get('content-security-policy') ?? ''
  check('Content-Security-Policy is set', csp.includes("default-src 'self'"))
  check("CSP forbids inline scripts (script-src 'self')", /script-src 'self'(;|$)/.test(csp))
  check(
    'X-Content-Type-Options: nosniff',
    response.headers.get('x-content-type-options') === 'nosniff',
  )
  check('framing is denied', response.headers.get('x-frame-options') === 'DENY')
  check('Referrer-Policy: no-referrer', response.headers.get('referrer-policy') === 'no-referrer')

  const html = await response.text()
  const asset = /\/assets\/[\w.-]+\.js/.exec(html)?.[0]
  check('index.html references a hashed script', Boolean(asset))
  if (asset) {
    const assetResponse = await fetch(target + asset)
    check('hashed asset loads', assetResponse.status === 200, `HTTP ${assetResponse.status}`)
    if (isLocal) skip('hashed asset is cached as immutable', 'only Vercel applies that header')
    else {
      check(
        'hashed asset is cached as immutable',
        (assetResponse.headers.get('cache-control') ?? '').includes('immutable'),
        assetResponse.headers.get('cache-control') ?? 'no cache-control',
      )
    }
    check(
      'no source map is published',
      (await fetch(`${target}${asset}.map`)).status !== 200 ||
        !(await (await fetch(`${target}${asset}.map`)).text()).includes('"mappings"'),
    )
  }
  if (!isLocal) check('served over HTTPS', target.startsWith('https://'))
}

async function unauthenticated(page: Page, problems: string[]) {
  await page.goto(`${target}/tasks`)
  await page.getByRole('heading', { name: 'PokéQuest' }).waitFor({ timeout: 15_000 })
  check('a protected deep link redirects to the login form', /\/login$/.test(page.url()))
  check('login form is rendered', await page.getByLabel('Senha').isVisible())

  await page.getByLabel('Email').fill('smoke-test-not-a-real-account@example.com')
  await page.getByLabel('Senha').fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const refused = await page
    .getByRole('alert')
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  check('the real Supabase project answers and refuses a wrong password', refused)
  check('still on the login page after a refused login', /\/login$/.test(page.url()))
  // The refused login itself logs a 400 from the auth API; that one is expected.
  const unexpected = problems.filter(
    (entry) => !/400|Invalid login|invalid_credentials/i.test(entry),
  )
  check(
    'no console errors or CSP violations while signed out',
    unexpected.length === 0,
    unexpected[0] ?? '',
  )
  problems.length = 0
}

async function authenticated(page: Page, problems: string[]) {
  const email = process.env.SMOKE_EMAIL
  const password = process.env.SMOKE_PASSWORD
  if (!email || !password) {
    skip('signed-in pages', 'set SMOKE_EMAIL and SMOKE_PASSWORD to include them')
    return
  }

  await page.goto(`${target}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  const signedIn = await page
    .getByRole('heading', { name: 'Dashboard' })
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false)
  check('sign-in reaches the Dashboard', signedIn)
  if (!signedIn) return

  await page.waitForLoadState('networkidle')
  check('Dashboard loads its data without an error', (await page.getByRole('alert').count()) === 0)

  const nav = page.getByRole('navigation', { name: 'Principal' })
  for (const { link, heading } of PAGES) {
    await nav.getByRole('link', { name: link }).click()
    const shown = await page
      .getByRole('heading', { name: heading, level: 1 })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    await page.waitForLoadState('networkidle')
    const alerts = await page.getByRole('alert').count()
    check(
      `${link} opens and reads from the database`,
      shown && alerts === 0,
      alerts ? `${alerts} error(s) shown` : '',
    )
  }

  await page.reload()
  check(
    'the session survives a reload on a deep link',
    await page
      .getByRole('heading', { name: 'Configurações', level: 1 })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false),
  )
  check(
    'no console errors or CSP violations while signed in',
    problems.length === 0,
    problems[0] ?? '',
  )

  await nav.getByRole('button', { name: 'Sair' }).click()
  check(
    'signing out returns to the login form',
    await page
      .getByRole('heading', { name: 'PokéQuest' })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false),
  )
}

async function main() {
  console.log(`Smoke test against ${target}\n`)
  await headers()

  const browser = await chromium.launch()
  try {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'phone', width: 360, height: 740 },
    ]) {
      console.log(`\n-- ${viewport.name} (${viewport.width}px)`)
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(message.text())
      })
      page.on('pageerror', (error) => problems.push(error.message))

      await unauthenticated(page, problems)
      await authenticated(page, problems)
      await context.close()
    }
  } finally {
    await browser.close()
  }

  console.log(failures === 0 ? '\nSmoke test passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
