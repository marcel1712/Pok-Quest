import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { FakeBackend } from '../support/fake-backend.ts'

// The flows the app exists for, end to end in a real browser, against a stateful fake of
// the Supabase API (tests/support/fake-backend.ts). They prove the frontend drives a
// well-behaved backend correctly — persistence across reloads, the focus timer, retries.
// They do NOT prove the real triggers/RLS: that is `npm run db:verify`.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' })

async function addTask(page: Page, title: string) {
  await page.getByPlaceholder('O que você precisa fazer?').fill(title)
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click()
  await expect(page.getByText(title)).toBeVisible()
}

/** Accepts the wild encounter (a 1-minute commitment) and lets the minute pass. */
async function runFocusSessionToTheEnd(page: Page) {
  await expect(page.getByText('Starly selvagem · Nv. 3')).toBeVisible()
  await page.getByRole('button', { name: 'Aceitar encontro' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.clock.fastForward('01:05')
  await expect(page.getByText('O tempo planejado terminou. Confirma a conclusão?')).toBeVisible()
}

test.describe('essential flows', () => {
  test('sign in, create a task, complete it, and find it still done after a reload', async ({
    page,
  }) => {
    const backend = new FakeBackend()
    await backend.install(page, { signedIn: false })

    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Email').fill('treinador@example.com')
    await page.getByLabel('Senha').fill('uma-senha-qualquer')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('0 para hoje · 0 pendentes')).toBeVisible()

    await addTask(page, 'Revisar o relatório mensal')
    await expect(page.getByText('0 para hoje · 1 pendente')).toBeVisible()

    await page.getByRole('button', { name: 'Concluir tarefa' }).click()
    await expect(page.getByText('0 para hoje · 0 pendentes')).toBeVisible()

    // Persistence: a full reload reads the state back from the server.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('0 para hoje · 0 pendentes')).toBeVisible()
    await expect(page.getByText('Revisar o relatório mensal')).toBeHidden()

    await nav(page).getByRole('link', { name: 'Tarefas' }).click()
    await page.getByRole('tab', { name: 'Concluídas' }).click()
    await expect(page.getByText('Revisar o relatório mensal')).toBeVisible()
    expect(backend.tables.tasks).toHaveLength(1)
    expect(backend.tables.tasks![0]!.status).toBe('completed')
  })

  test('focus session: finish, confirm, win the battle, get paid exactly once, capture', async ({
    page,
  }) => {
    const backend = new FakeBackend()
    await backend.install(page)
    await page.clock.install({ time: new Date() })

    await page.goto('/focus')
    await runFocusSessionToTheEnd(page)
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()

    await page.getByRole('button', { name: 'Pular animação' }).click()
    await expect(page.getByText('Vitória contra Pokémon selvagem!')).toBeVisible()
    await expect(page.getByText('+2 XP')).toBeVisible()

    await page.getByRole('button', { name: 'Capturar' }).click()
    await expect(page.getByText('Starly capturado!')).toBeVisible()

    expect(backend.tables.reward_events).toHaveLength(1)
    expect(backend.totalXpGranted()).toBe(2)
    expect(backend.tables.captures).toHaveLength(1)

    // The reward reached the party, and the next encounter is a new one.
    await page.getByRole('button', { name: 'Continuar' }).click()
    await nav(page).getByRole('link', { name: 'Equipe' }).click()
    await expect(page.getByRole('heading', { name: 'Equipe', level: 1 })).toBeVisible()
    expect(backend.tables.owned_pokemon!.find((p) => p.pokedex_number === 390)!.xp).toBe(127)
    expect(
      backend.tables.encounters!.filter((e) => e.consumed_at === null).length,
    ).toBeLessThanOrEqual(1)
    expect(backend.tables.encounters!.filter((e) => e.consumed_at !== null)).toHaveLength(1)
  })

  test('reloading in the middle of a session keeps the countdown where it was', async ({
    page,
  }) => {
    const backend = new FakeBackend()
    await backend.install(page)
    await page.clock.install({ time: new Date() })

    await page.goto('/focus')
    await page.getByRole('button', { name: 'Aceitar encontro' }).click()
    await expect(page.getByRole('timer')).toHaveText(/^0[01]:\d\d$/)

    await page.clock.fastForward('00:20')
    await expect(page.getByRole('timer')).toHaveText(/^00:(3\d|4[01])$/)

    await page.reload()

    // Not back to 01:00: the timer is recomputed from the session's saved start.
    await expect(page.getByRole('timer')).toHaveText(/^00:(3\d|4[01])$/)
    await expect(
      page.getByText('Encontro: Pokémon selvagem — compromisso: foco ≥ 1 min'),
    ).toBeVisible()
    expect(backend.tables.focus_sessions).toHaveLength(1)
    expect(backend.tables.battles).toHaveLength(1)
  })

  test('a confirmation whose response is lost can be retried without doubling the XP', async ({
    page,
  }) => {
    const backend = new FakeBackend()
    await backend.install(page)
    await page.clock.install({ time: new Date() })

    await page.goto('/focus')
    await runFocusSessionToTheEnd(page)

    // The server completes the session and pays the battle, but the answer never arrives.
    backend.loseNextResponse(
      (method, table, body) =>
        method === 'PATCH' && table === 'focus_sessions' && body?.status === 'completed',
    )
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    expect(backend.tables.reward_events).toHaveLength(1)

    // The user tries again. The session is already completed: nothing is applied twice.
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
    await page.getByRole('button', { name: 'Pular animação' }).click()
    await expect(page.getByText('Vitória contra Pokémon selvagem!')).toBeVisible()
    await expect(page.getByText('+2 XP')).toBeVisible()

    expect(backend.tables.reward_events).toHaveLength(1)
    expect(backend.totalXpGranted()).toBe(2)
    expect(backend.tables.focus_sessions!.filter((s) => s.status === 'completed')).toHaveLength(1)
  })

  test('moving between pages never reloads the document, and they agree with each other', async ({
    page,
  }) => {
    const backend = new FakeBackend()
    await backend.install(page)

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // Survives client-side navigation; a full page load would wipe it.
    await page.evaluate('window.__sameDocument = true')

    await nav(page).getByRole('link', { name: 'Tarefas' }).click()
    await expect(page.getByRole('heading', { name: 'Tarefas', level: 1 })).toBeVisible()
    await addTask(page, 'Organizar a mesa')
    await addTask(page, 'Responder emails')

    await nav(page).getByRole('link', { name: 'Equipe' }).click()
    await expect(page.getByRole('heading', { name: 'Equipe', level: 1 })).toBeVisible()
    await expect(page.getByText('Chimchar').first()).toBeVisible()

    // The dashboard, visited before the tasks existed, shows them without a reload.
    await nav(page).getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByText('0 para hoje · 2 pendentes')).toBeVisible()
    await expect(page.getByText('Organizar a mesa')).toBeVisible()

    await page.getByRole('button', { name: 'Concluir tarefa' }).first().click()
    await expect(page.getByText('0 para hoje · 1 pendente')).toBeVisible()

    await nav(page).getByRole('link', { name: 'Tarefas' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(1)

    expect(await page.evaluate('window.__sameDocument === true')).toBe(true)
  })
})

test.describe('essential flows on a phone (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  test('tasks and focus are fully usable with touch on a small screen', async ({ page }) => {
    const backend = new FakeBackend()
    await backend.install(page)
    await page.clock.install({ time: new Date() })

    await page.goto('/')
    await page.getByPlaceholder('O que você precisa fazer?').fill('Comprar ração')
    await page.getByRole('button', { name: 'Adicionar tarefa' }).tap()
    await expect(page.getByText('Comprar ração')).toBeVisible()
    await page.getByRole('button', { name: 'Concluir tarefa' }).tap()
    await expect(page.getByText('0 para hoje · 0 pendentes')).toBeVisible()

    const startFocus = page.getByRole('link', { name: 'Iniciar foco' })
    await expect(startFocus).toBeInViewport()
    await startFocus.tap()

    const accept = page.getByRole('button', { name: 'Aceitar encontro' })
    await expect(accept).toBeInViewport()
    await accept.tap()
    await page.clock.fastForward('01:05')

    const confirm = page.getByRole('button', { name: 'Confirmar conclusão' })
    await expect(confirm).toBeInViewport()
    await confirm.tap()
    await page.getByRole('button', { name: 'Pular animação' }).tap()
    await expect(page.getByText('Vitória contra Pokémon selvagem!')).toBeVisible()

    expect(backend.tables.reward_events).toHaveLength(1)
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
