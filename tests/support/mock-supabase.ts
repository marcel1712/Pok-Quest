import { readFileSync } from 'node:fs'
import type { Page, Route } from '@playwright/test'

// A fake session plus a fully mocked Supabase API for browser tests and measurements.
// Every request to the Supabase host is answered here, so nothing ever reads or writes
// the real project (which, in this single-environment setup, would be production).
// Good for layout, navigation and request-count checks; it proves nothing about RLS,
// triggers or real data.

function supabaseUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL
  const match = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync('.env', 'utf8'))
  if (!match?.[1]) throw new Error('VITE_SUPABASE_URL not found in the environment or .env')
  return match[1].trim()
}

export const SUPABASE_HOST = new URL(supabaseUrl()).hostname
export const STORAGE_KEY = `sb-${SUPABASE_HOST.split('.')[0]}-auth-token`
export const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-10-14T12:00:00Z'

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function fakeSession() {
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

export function species(pokedexNumber: number, name: string) {
  return {
    pokedex_number: pokedexNumber,
    name,
    types: ['normal'],
    sprite_url: null,
    official_artwork_url: null,
    animated_sprite_url: null,
    is_starter: false,
    is_legendary: false,
    evolves_to_pokedex_number: null,
    evolution_min_level: null,
    catalog_version: 3,
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
  history_entries: [
    {
      owner_id: OWNER_ID,
      kind: 'task',
      occurred_at: NOW,
      entry_id: 'e1',
      title:
        'Uma tarefa de título bem comprido para testar a quebra de linha no histórico em telas estreitas',
      detail: null,
      amount: 3,
    },
    {
      owner_id: OWNER_ID,
      kind: 'battle',
      occurred_at: NOW,
      entry_id: 'e2',
      title: 'Starly',
      detail: 'wild · Rota 201',
      amount: 45,
    },
  ],
}

const HISTORY_SUMMARY = ['today', 'last7Days', 'last30Days', 'allTime'].map((period) => ({
  period,
  tasks_completed: 12,
  focus_sessions: 34,
  focus_minutes: 1234,
  victories: 56,
  xp_earned: 123456,
  captures: 7,
}))

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

export type MockSupabaseOptions = {
  /** Delay added to every answer, to make request waterfalls visible in timings. */
  latencyMs?: number
  /** Called once per API request with a short label, e.g. "GET tasks?status=eq.pending". */
  onRequest?: (label: string) => void
  /** Called right after each API answer has been delivered. */
  onResponse?: () => void
}

async function answer(route: Route, options: MockSupabaseOptions) {
  const request = route.request()
  const url = new URL(request.url())
  const json = async (body: unknown, status = 200) => {
    if (options.latencyMs) await new Promise((resolve) => setTimeout(resolve, options.latencyMs))
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    options.onResponse?.()
  }

  if (url.pathname.startsWith('/auth/')) return json(fakeSession().user)

  const resource = url.pathname.replace('/rest/v1/', '')
  const filters = [...url.searchParams.entries()]
    .filter(([key]) => !['select', 'order', 'limit', 'occurred_at'].includes(key))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  options.onRequest?.(`${request.method()} ${resource}${filters ? `?${filters}` : ''}`)

  if (url.pathname.endsWith('/rpc/get_or_create_encounter')) return json(ENCOUNTER)
  if (url.pathname.endsWith('/rpc/get_history_summary')) return json(HISTORY_SUMMARY)
  if (request.method() !== 'GET') return json({ message: 'writes are not mocked' }, 400)

  const table = url.pathname.split('/').pop() ?? ''
  let rows = TABLES[table] ?? []
  const pokedexFilter = url.searchParams.get('pokedex_number')
  if (table === 'species_catalog' && pokedexFilter) {
    const wanted = pokedexFilter
      .replace(/^(eq\.|in\.\(|\)$)/g, '')
      .replace(/\)$/, '')
      .split(',')
    rows = rows.filter((row) =>
      wanted.includes(String((row as { pokedex_number: number }).pokedex_number)),
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

/** Installs the fake session and API mock. Call before the first navigation. */
export async function mockSupabase(page: Page, options: MockSupabaseOptions = {}) {
  await page.route(
    (url) => url.hostname === SUPABASE_HOST,
    (route) => answer(route, options),
  )
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key as string, JSON.stringify(session)),
    [STORAGE_KEY, fakeSession()] as const,
  )
}
