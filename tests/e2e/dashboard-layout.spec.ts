import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockSupabase } from '../support/mock-supabase.ts'

// Layout checks at phone, tablet and wide-desktop widths, with a long task list, against
// a fake session and a fully mocked Supabase API (see tests/support/mock-supabase.ts).

async function openDashboard(page: Page) {
  await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

const VIEWPORTS = [
  { name: 'phone (360px)', width: 360, height: 740 },
  { name: 'tablet (768px)', width: 768, height: 1024 },
  { name: 'wide desktop (1920px)', width: 1920, height: 1080 },
]

for (const viewport of VIEWPORTS) {
  test.describe(`dashboard layout — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('shows every section, caps the long task list and never scrolls sideways', async ({
      page,
    }) => {
      await openDashboard(page)

      const priorityTasks = page.getByRole('list', { name: 'Tarefas prioritárias' })
      await expect(priorityTasks.getByRole('listitem')).toHaveCount(5)
      await expect(page.getByText('+ 55 em Tarefas')).toBeVisible()

      await expect(page.getByText('Starly selvagem · Nv. 3')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Iniciar foco' })).toBeVisible()
      await expect(
        page.getByRole('list', { name: 'Time ativo' }).getByRole('listitem'),
      ).toHaveCount(6)
      await expect(page.getByText('1 de 3 etapas · 0/1 insígnias')).toBeVisible()

      const overflow = await page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)

      // Every action stays inside the viewport horizontally.
      for (const name of ['Iniciar foco', 'Ver todas', 'Gerenciar', 'Ver jornada']) {
        const box = await page.getByRole('link', { name }).boundingBox()
        expect(box, name).not.toBeNull()
        expect(box!.x, name).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width, name).toBeLessThanOrEqual(viewport.width)
      }
    })
  })
}

const PAGES = [
  { path: '/tasks', heading: 'Tarefas' },
  { path: '/focus', heading: 'Foco' },
  { path: '/team', heading: 'Equipe' },
  { path: '/journey', heading: 'Jornada' },
  { path: '/settings', heading: 'Configurações' },
]

test.describe('every page on a phone (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const { path, heading } of PAGES) {
    test(`${path} renders without scrolling sideways`, async ({ page }) => {
      await openDashboard(page)
      await page
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('link', { name: heading })
        .click()
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
      if (process.env.SHOT_DIR) {
        await page.screenshot({
          path: `${process.env.SHOT_DIR}/page${path.replace('/', '-')}.png`,
          fullPage: true,
        })
      }
    })
  }
})
