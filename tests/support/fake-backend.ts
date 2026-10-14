import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import { fakeSession, OWNER_ID, species, STORAGE_KEY, SUPABASE_HOST } from './mock-supabase.ts'

// A small STATEFUL stand-in for the Supabase API, for end-to-end flows (T-037): what the
// app writes is remembered and read back, so "create a task, reload, it is still there"
// and "finish a session, get paid once" can be exercised in a real browser without ever
// touching the real project.
//
// It speaks just enough PostgREST for this app (eq / in / gte filters, order, limit,
// insert, conditional update, single-object responses, a few RPCs) and re-implements,
// in a few lines each, the server rules those flows depend on — one active session,
// battle resolution on completion, XP to the party, one capture per battle.
//
// That re-implementation is the limit of what these tests prove: they cover the
// FRONTEND's handling of a well-behaved backend. Whether the real triggers, RPCs and
// RLS behave this way is what `npm run db:verify` checks, against the real database.

type Row = Record<string, unknown>

const ROUTE_NODE = 'sinnoh.route-201'

function nodes(): Row[] {
  const base = {
    region_id: 'sinnoh',
    summary: 'Resumo',
    npc_name: null,
    scene_intro: [],
    scene_outro: [],
    badge_name: null,
  }
  return [
    {
      ...base,
      id: 'sinnoh.twinleaf-town',
      sort_order: 1,
      kind: 'story',
      title: 'Twinleaf Town',
      encounter_kind: 'milestone',
      encounter_difficulty: 1,
      required_victories: 1,
      repeatable: false,
    },
    {
      ...base,
      id: ROUTE_NODE,
      sort_order: 2,
      kind: 'route',
      title: 'Rota 201',
      encounter_kind: 'wild',
      encounter_difficulty: 1,
      required_victories: 3,
      repeatable: true,
    },
  ]
}

export class FakeBackend {
  readonly tables: Record<string, Row[]>
  /** Every API call, e.g. "PATCH focus_sessions". */
  readonly requests: string[] = []
  private loseNextResponseFor:
    ((method: string, table: string, body: Row | null) => boolean) | null = null

  constructor() {
    const now = new Date().toISOString()
    this.tables = {
      profiles: [{ id: OWNER_ID, timezone: 'UTC', settings: {}, created_at: now, updated_at: now }],
      tasks: [],
      focus_sessions: [],
      battles: [],
      reward_events: [],
      captures: [],
      encounters: [],
      badges: [],
      species_catalog: [species(390, 'Chimchar'), species(396, 'Starly')],
      owned_pokemon: [
        {
          id: randomUUID(),
          owner_id: OWNER_ID,
          pokedex_number: 390,
          nickname: null,
          level: 5,
          xp: 125,
          party_position: 1,
          pending_evolution_to_pokedex_number: null,
          captured_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
      game_progress: [
        {
          owner_id: OWNER_ID,
          starter_pokedex_number: 390,
          starter_owned_pokemon_id: null,
          starter_chosen_at: now,
        },
      ],
      campaign_nodes: nodes(),
      campaign_node_prerequisites: [
        { node_id: ROUTE_NODE, requires_node_id: 'sinnoh.twinleaf-town' },
      ],
      campaign_node_progress: [
        { owner_id: OWNER_ID, node_id: 'sinnoh.twinleaf-town', victories: 1, completed_at: now },
      ],
      history_entries: [],
    }
  }

  /**
   * The next matching request is APPLIED but its response never arrives — the classic
   * "it worked, but the client does not know" failure a retry has to survive.
   */
  loseNextResponse(matches: (method: string, table: string, body: Row | null) => boolean) {
    this.loseNextResponseFor = matches
  }

  /** Installs the fake API. Pass `signedIn: false` to start at the login screen. */
  async install(page: Page, { signedIn = true }: { signedIn?: boolean } = {}) {
    await page.route(
      (url) => url.hostname === SUPABASE_HOST,
      (route) => this.handle(route),
    )
    if (signedIn) {
      await page.addInitScript(
        ([key, session]) => localStorage.setItem(key as string, JSON.stringify(session)),
        [STORAGE_KEY, fakeSession()] as const,
      )
    }
  }

  totalXpGranted(): number {
    return this.tables.reward_events!.reduce((sum, row) => sum + (row.amount as number), 0)
  }

  // ── request handling ──────────────────────────────────────────────────────────

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (url.pathname.startsWith('/auth/')) {
      if (url.pathname.endsWith('/token')) return respond(fakeSession())
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
      return respond(fakeSession().user)
    }

    const resource = url.pathname.replace('/rest/v1/', '')
    const body = (request.postDataJSON() ?? null) as Row | null
    this.requests.push(`${method} ${resource}`)

    let result: { status: number; body: unknown }
    if (resource.startsWith('rpc/')) {
      result = this.rpc(resource.slice(4), body ?? {})
    } else {
      const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      result = this.rest(method, resource, url.searchParams, body, wantsObject)
    }

    if (this.loseNextResponseFor?.(method, resource, body)) {
      this.loseNextResponseFor = null
      return route.abort('connectionreset')
    }
    return respond(result.body, result.status)
  }

  private rest(
    method: string,
    table: string,
    params: URLSearchParams,
    body: Row | null,
    wantsObject: boolean,
  ): { status: number; body: unknown } {
    const rows = (this.tables[table] ??= [])
    let affected: Row[]

    if (method === 'POST') {
      const inserted = this.insert(table, body ?? {})
      if ('error' in inserted) return { status: 409, body: inserted.error }
      affected = [inserted.row]
    } else {
      affected = rows.filter((row) => matches(row, params))
      if (method === 'PATCH') {
        for (const row of affected) this.update(table, row, body ?? {})
      }
      affected = sortAndLimit(affected, params)
    }

    if (!wantsObject) return { status: method === 'POST' ? 201 : 200, body: affected }
    if (affected.length === 1) return { status: 200, body: affected[0] }
    return {
      status: 406,
      body: { code: 'PGRST116', message: 'no single row', details: `${affected.length} rows` },
    }
  }

  private insert(table: string, values: Row): { row: Row } | { error: Row } {
    const now = new Date().toISOString()
    let row: Row = { id: randomUUID(), created_at: now, updated_at: now, ...values }

    if (table === 'tasks') {
      row = { status: 'pending', completed_at: null, description: null, category_id: null, ...row }
    }

    if (table === 'focus_sessions') {
      const active = this.tables.focus_sessions!.some((session) =>
        ['running', 'paused'].includes(session.status as string),
      )
      // One active session per owner, like the unique index in the real schema.
      if (active) return { error: { code: '23505', message: 'duplicate key value' } }
      row = {
        status: 'running',
        started_at: now,
        paused_at: null,
        accumulated_pause_seconds: 0,
        ended_at: null,
        task_id: null,
        ...row,
      }
    }

    if (table === 'battles') {
      const encounter = this.tables.encounters!.find((entry) => entry.id === values.encounter_id)
      row = {
        status: 'pending',
        result: null,
        resolved_at: null,
        team_multiplier_applied: null,
        task_id: null,
        focus_session_id: null,
        commitment_min_difficulty: null,
        commitment_min_duration_minutes: null,
        ...row,
        // The server, not the client, decides where the battle is and what appears.
        campaign_node_id: encounter?.campaign_node_id ?? null,
        encounter_kind: encounter?.encounter_kind ?? values.encounter_kind,
        encounter_difficulty: encounter?.encounter_difficulty ?? values.encounter_difficulty,
        wild_species_pokedex_number: encounter?.wild_species_pokedex_number ?? null,
        wild_level: encounter?.wild_level ?? null,
      }
    }

    this.tables[table]!.push(row)
    return { row }
  }

  private update(table: string, row: Row, patch: Row) {
    const before = row.status
    Object.assign(row, patch, { updated_at: new Date().toISOString() })

    if (table === 'focus_sessions' && before !== 'completed' && row.status === 'completed') {
      this.resolveBattleFor(row)
    }
  }

  /** What resolve_pending_battle and the campaign triggers do, reduced to essentials. */
  private resolveBattleFor(session: Row) {
    const battle = this.tables.battles!.find(
      (entry) => entry.focus_session_id === session.id && entry.status === 'pending',
    )
    if (!battle) return

    const minutes = (session.planned_duration_seconds as number) / 60
    const won = minutes >= (battle.commitment_min_duration_minutes as number)
    Object.assign(battle, {
      status: 'resolved',
      result: won ? 'victory' : 'withdrawal',
      resolved_at: new Date().toISOString(),
      team_multiplier_applied: 1,
    })
    if (!won) return

    const xp = Math.round(minutes * 1.5)
    this.tables.reward_events!.push({
      id: randomUUID(),
      owner_id: OWNER_ID,
      source_type: 'battle',
      source_id: battle.id,
      reward_type: 'xp',
      amount: xp,
      created_at: new Date().toISOString(),
    })

    const party = this.tables.owned_pokemon!.filter((entry) => entry.party_position !== null)
    for (const member of party) {
      member.xp = (member.xp as number) + Math.floor(xp / party.length)
    }

    const encounter = this.tables.encounters!.find((entry) => entry.id === battle.encounter_id)
    if (encounter) {
      Object.assign(encounter, {
        consumed_at: new Date().toISOString(),
        consumed_by_battle_id: battle.id,
      })
    }

    const progress = this.tables.campaign_node_progress!
    const nodeProgress = progress.find((entry) => entry.node_id === battle.campaign_node_id)
    if (nodeProgress) nodeProgress.victories = (nodeProgress.victories as number) + 1
    else {
      progress.push({
        owner_id: OWNER_ID,
        node_id: battle.campaign_node_id,
        victories: 1,
        completed_at: null,
      })
    }
  }

  private rpc(name: string, args: Row): { status: number; body: unknown } {
    if (name === 'get_or_create_encounter') {
      let open = this.tables.encounters!.find((entry) => entry.consumed_at === null)
      if (!open) {
        open = {
          id: randomUUID(),
          owner_id: OWNER_ID,
          campaign_node_id: ROUTE_NODE,
          encounter_kind: 'wild',
          encounter_difficulty: 1,
          wild_species_pokedex_number: 396,
          wild_level: 3,
          created_at: new Date().toISOString(),
          consumed_at: null,
          consumed_by_battle_id: null,
        }
        this.tables.encounters!.push(open)
      }
      return { status: 200, body: open }
    }

    if (name === 'capture_from_battle') {
      const battle = this.tables.battles!.find((entry) => entry.id === args.p_battle_id)
      if (!battle || battle.result !== 'victory' || !battle.wild_species_pokedex_number) {
        return { status: 400, body: { code: 'P0001', message: 'capture not allowed' } }
      }
      // One capture per battle: a repeated call returns the same Pokémon.
      const existing = this.tables.captures!.find((entry) => entry.battle_id === battle.id)
      if (existing) {
        return {
          status: 200,
          body: this.tables.owned_pokemon!.find((entry) => entry.id === existing.owned_pokemon_id),
        }
      }
      const now = new Date().toISOString()
      const level = (battle.wild_level as number) ?? 5
      const pokemon = {
        id: randomUUID(),
        owner_id: OWNER_ID,
        pokedex_number: battle.wild_species_pokedex_number,
        nickname: null,
        level,
        xp: level ** 3,
        party_position: null,
        pending_evolution_to_pokedex_number: null,
        captured_at: now,
        created_at: now,
        updated_at: now,
      }
      this.tables.owned_pokemon!.push(pokemon)
      this.tables.captures!.push({
        id: randomUUID(),
        owner_id: OWNER_ID,
        battle_id: battle.id,
        pokedex_number: pokemon.pokedex_number,
        owned_pokemon_id: pokemon.id,
        created_at: now,
      })
      return { status: 200, body: pokemon }
    }

    if (name === 'get_history_summary') return { status: 200, body: [] }
    return { status: 404, body: { code: 'PGRST202', message: `unknown function ${name}` } }
  }
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [column, expression] of params) {
    if (['select', 'order', 'limit'].includes(column)) continue
    const value = row[column] === null || row[column] === undefined ? null : String(row[column])

    if (expression.startsWith('eq.')) {
      if (value !== expression.slice(3)) return false
    } else if (expression.startsWith('in.(')) {
      const wanted = expression
        .slice(4, -1)
        .split(',')
        .map((entry) => entry.replace(/^"|"$/g, ''))
      if (value === null || !wanted.includes(value)) return false
    } else if (expression.startsWith('gte.')) {
      if (value === null || value < expression.slice(4)) return false
    } else {
      throw new Error(`fake backend: unsupported filter ${column}=${expression}`)
    }
  }
  return true
}

function sortAndLimit(rows: Row[], params: URLSearchParams): Row[] {
  let result = [...rows]
  const order = params.get('order')
  if (order) {
    const [column, direction] = order.split('.') as [string, string | undefined]
    result.sort((a, b) => {
      const left = a[column] ?? ''
      const right = b[column] ?? ''
      const compared = left < right ? -1 : left > right ? 1 : 0
      return direction === 'desc' ? -compared : compared
    })
  }
  const limit = params.get('limit')
  if (limit) result = result.slice(0, Number(limit))
  return result
}
