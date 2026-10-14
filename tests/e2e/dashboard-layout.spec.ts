import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

// Layout check for the dashboard at phone, tablet and wide-desktop widths, with a long
// task list. It runs against a FAKE session and a fully mocked Supabase API: every
// request to the Supabase host is answered here, so it never reads or writes the real
// project (which, in this single-environment setup, would be production).

function supabaseUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL
  const match = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync('.env', 'utf8'))
  if (!match?.[1]) throw new Error('VITE_SUPABASE_URL not found in the environment or .env')
  return match[1].trim()
}

const SUPABASE_HOST = new URL(supabaseUrl()).hostname
const STORAGE_KEY = `sb-${SUPABASE_HOST.split('.')[0]}-auth-token`
const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-10-14T12:00:00Z'

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

function fakeSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const user = {
    id: OWNER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: NOW,
  }
  return {
    access_token: `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: OWNER_ID, role: 'authenticated', exp: expiresAt })}.e2e`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user,
  }
}

function species(pokedexNumber: number, name: string) {
  return {
    pokedex_number: pokedexNumber,
    name,
    types: ['normal'],
    sprite_url: null,
    official_artwork_url: null,
    is_starter: false,
    is_legendary: false,
    evolves_to_pokedex_number: null,
    evolution_min_level: null,
    catalog_version: 2,
    imported_at: NOW,
  }
}

const SPECIES = [
  species(390, 'Chimchar'),
  species(396, 'Starly'),
  species(399, 'Bidoof'),
  species(403, 'Shinx'),
  species(406, 'Budew'),
  species(418, 'Buizel'),
]

const TASKS = Array.from({ length: 60 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  owner_id: OWNER_ID,
  title: `Tarefa ${index + 1}: um título comprido o bastante para precisar quebrar linha em telas estreitas sem empurrar o layout`,
  description: null,
  category_id: null,
  difficulty: (index % 5) + 1,
  due_date: null,
  status: 'pending',
  completed_at: null,
  created_at: NOW,
  updated_at: NOW,
}))

const NODES = ['Twinleaf Town', 'Rota 201', 'Ginásio de Oreburgh'].map((title, index) => ({
  id: `sinnoh.node-${index + 1}`,
  region_id: 'sinnoh',
  sort_order: index + 1,
  kind: index === 2 ? 'gym' : 'route',
  title,
  summary: 'Resumo',
  npc_name: null,
  encounter_kind: 'wild',
  encounter_difficulty: 1,
  required_victories: 3,
  repeatable: index !== 2,
  badge_name: index === 2 ? 'Insígnia do Carvão' : null,
  scene_intro: [],
  scene_outro: [],
}))

const TABLES: Record<string, unknown[]> = {
  tasks: TASKS,
  species_catalog: SPECIES,
  owned_pokemon: SPECIES.map((entry, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index}`,
    owner_id: OWNER_ID,
    pokedex_number: entry.pokedex_number,
    nickname: null,
    level: 12 + index,
    xp: (12 + index) ** 3 + 50,
    party_position: index + 1,
    pending_evolution_to_pokedex_number: null,
    captured_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  })),
  campaign_nodes: NODES,
  campaign_node_prerequisites: [],
  campaign_node_progress: [
    { owner_id: OWNER_ID, node_id: 'sinnoh.node-1', victories: 3, completed_at: NOW },
  ],
  badges: [],
  game_progress: [
    {
      owner_id: OWNER_ID,
      starter_pokedex_number: 390,
      starter_owned_pokemon_id: '10000000-0000-4000-8000-000000000000',
      starter_chosen_at: NOW,
    },
  ],
  profiles: [{ id: OWNER_ID, timezone: 'UTC', settings: {}, created_at: NOW, updated_at: NOW }],
  focus_sessions: [],
}

const ENCOUNTER = {
  id: '20000000-0000-4000-8000-000000000000',
  owner_id: OWNER_ID,
  campaign_node_id: 'sinnoh.node-2',
  encounter_kind: 'wild',
  encounter_difficulty: 1,
  wild_species_pokedex_number: 396,
  wild_level: 3,
  created_at: NOW,
  consumed_at: null,
  consumed_by_battle_id: null,
}

async function answerSupabase(route: Route) {
  const request = route.request()
  const url = new URL(request.url())
  const json = (body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  if (url.pathname.startsWith('/auth/')) return json(fakeSession().user)
  if (url.pathname.endsWith('/rpc/get_or_create_encounter')) return json(ENCOUNTER)
  if (request.method() !== 'GET') return json({ message: 'writes are not mocked' }, 400)

  const table = url.pathname.split('/').pop() ?? ''
  let rows = TABLES[table] ?? []
  const pokedexFilter = url.searchParams.get('pokedex_number')
  if (table === 'species_catalog' && pokedexFilter) {
    rows = rows.filter(
      (row) => `eq.${(row as { pokedex_number: number }).pokedex_number}` === pokedexFilter,
    )
  }

  // `.single()` / `.maybeSingle()` ask PostgREST for one object instead of an array.
  if ((request.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
    return rows.length === 1
      ? json(rows[0])
      : json({ code: 'PGRST116', message: 'no single row', details: `${rows.length} rows` }, 406)
  }
  return json(rows)
}

async function openDashboard(page: Page) {
  await page.route((url) => url.hostname === SUPABASE_HOST, answerSupabase)
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key as string, JSON.stringify(session)),
    [STORAGE_KEY, fakeSession()] as const,
  )
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
