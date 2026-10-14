import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { createBattle, getBattleForFocusSession } from '@/features/battles/api/battles-repository'
import {
  getActiveSession,
  listCompletedSessions,
  startSession,
  transitionSession,
} from '@/features/focus/api/focus-sessions-repository'
import {
  getCampaignContent,
  getCurrentEncounter,
  listCampaignProgress,
} from '@/features/journey/api/campaign-repository'
import { getSpeciesByPokedexNumber } from '@/features/pokemon/api/species-catalog-repository'
import { listRewardEvents } from '@/features/rewards/api/reward-events-repository'
import { getProfile, updateFocusPreferences } from '@/features/settings/api/profile-repository'
import { getTaskById, listTasks } from '@/features/tasks/api/tasks-repository'
import type { Battle } from '@/features/battles/types'
import type { FocusSession } from '@/features/focus/types'
import { FocusPage } from './FocusPage'

vi.mock('@/features/journey/api/campaign-repository', () => ({
  getCampaignContent: vi.fn(),
  listCampaignProgress: vi.fn(),
  getCurrentEncounter: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  getSpeciesByPokedexNumber: vi.fn(),
  listSpeciesCatalog: vi.fn(),
}))

vi.mock('@/features/battles/api/battles-repository', () => ({
  createBattle: vi.fn(),
  getBattleById: vi.fn(),
  getBattleForTask: vi.fn(),
  getBattleForFocusSession: vi.fn(),
}))

vi.mock('@/features/rewards/api/reward-events-repository', () => ({
  listRewardEvents: vi.fn(),
}))

vi.mock('@/features/focus/api/focus-sessions-repository', () => ({
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  transitionSession: vi.fn(),
  listCompletedSessions: vi.fn(),
}))

vi.mock('@/features/settings/api/profile-repository', () => ({
  getProfile: vi.fn(),
  updateFocusPreferences: vi.fn(),
}))

vi.mock('@/features/tasks/api/tasks-repository', () => ({
  listTasks: vi.fn(),
  getTaskById: vi.fn(),
}))

const createBattleMock = vi.mocked(createBattle)
const getBattleForFocusSessionMock = vi.mocked(getBattleForFocusSession)
const listRewardEventsMock = vi.mocked(listRewardEvents)
const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)
const getCurrentEncounterMock = vi.mocked(getCurrentEncounter)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)

const wildEncounter = {
  id: 'encounter-1',
  owner_id: 'owner-1',
  campaign_node_id: 'sinnoh.route-201',
  encounter_kind: 'wild',
  encounter_difficulty: 1,
  wild_species_pokedex_number: 396,
  wild_level: 3,
  created_at: '2026-10-13T00:00:00Z',
  consumed_at: null,
  consumed_by_battle_id: null,
}

const starly = {
  pokedex_number: 396,
  name: 'Starly',
  types: ['normal', 'flying'],
  sprite_url: null,
  official_artwork_url: null,
  is_starter: false,
  is_legendary: false,
  evolves_to_pokedex_number: 397,
  evolution_min_level: 14,
  catalog_version: 2,
  imported_at: '2026-10-13T00:00:00Z',
}

const campaignContent = {
  nodes: [
    {
      id: 'sinnoh.route-201',
      region_id: 'sinnoh',
      sort_order: 1,
      kind: 'route',
      title: 'Rota 201',
      summary: 'Grama alta.',
      npc_name: null,
      encounter_kind: 'wild',
      encounter_difficulty: 1,
      required_victories: 3,
      repeatable: true,
    },
  ],
  prerequisites: [],
}
const getActiveSessionMock = vi.mocked(getActiveSession)
const startSessionMock = vi.mocked(startSession)
const transitionSessionMock = vi.mocked(transitionSession)
const listCompletedSessionsMock = vi.mocked(listCompletedSessions)
const getProfileMock = vi.mocked(getProfile)
const updateFocusPreferencesMock = vi.mocked(updateFocusPreferences)
const listTasksMock = vi.mocked(listTasks)
const getTaskByIdMock = vi.mocked(getTaskById)

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 'session-1',
    owner_id: 'owner-1',
    task_id: null,
    planned_duration_seconds: 1500,
    status: 'running',
    started_at: new Date().toISOString(),
    paused_at: null,
    accumulated_pause_seconds: 0,
    ended_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'battle-1',
    owner_id: 'owner-1',
    encounter_kind: 'wild',
    encounter_difficulty: 1,
    commitment_type: 'focusSession',
    commitment_min_difficulty: null,
    commitment_min_duration_minutes: 1,
    task_id: null,
    focus_session_id: 'session-1',
    status: 'pending',
    result: null,
    team_multiplier_applied: null,
    wild_species_pokedex_number: null,
    campaign_node_id: 'sinnoh.route-201',
    encounter_id: 'encounter-1',
    wild_level: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FocusPage />
    </QueryClientProvider>,
  )
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'owner-1',
    timezone: 'UTC',
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  createBattleMock.mockReset()
  getBattleForFocusSessionMock.mockReset().mockResolvedValue(null)
  listRewardEventsMock.mockReset().mockResolvedValue([])
  getCampaignContentMock.mockReset().mockResolvedValue(campaignContent)
  listCampaignProgressMock.mockReset().mockResolvedValue([])
  getCurrentEncounterMock.mockReset().mockResolvedValue(wildEncounter)
  getSpeciesByPokedexNumberMock.mockReset().mockResolvedValue(starly)
  getActiveSessionMock.mockReset()
  startSessionMock.mockReset()
  transitionSessionMock.mockReset()
  listCompletedSessionsMock.mockReset().mockResolvedValue([])
  getProfileMock.mockReset().mockResolvedValue(makeProfile() as never)
  updateFocusPreferencesMock.mockReset()
  listTasksMock.mockReset().mockResolvedValue([])
  getTaskByIdMock.mockReset()
  useAuthStore.setState({ status: 'authenticated', session: { user: { id: 'owner-1' } } as never })
})

async function skipToPlainStartForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Focar sem encontro' }))
  return screen.findByRole('button', { name: 'Iniciar foco' })
}

describe('FocusPage — encounter before starting', () => {
  it('shows a pre-battle card with the viable commitment by default', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText('Starly selvagem · Nv. 3')).toBeInTheDocument()
    expect(screen.getByText('Rota 201')).toBeInTheDocument()
    expect(
      screen.getByText('sessão de foco de pelo menos 1 min', { exact: false }),
    ).toBeInTheDocument()
  })

  it('accepting the encounter starts a session for the required duration and creates a battle', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    startSessionMock.mockResolvedValue(makeSession({ planned_duration_seconds: 60 }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar encontro' }))

    await waitFor(() =>
      expect(startSessionMock).toHaveBeenCalledWith('owner-1', {
        plannedDurationSeconds: 60,
        taskId: null,
      }),
    )
    await waitFor(() =>
      expect(createBattleMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({
          commitmentType: 'focusSession',
          minDurationMinutes: 1,
          focusSessionId: 'session-1',
          encounterId: 'encounter-1',
        }),
      ),
    )
  })

  it('shows a non-wild encounter by its kind, with no species', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    getCurrentEncounterMock.mockResolvedValue({
      ...wildEncounter,
      encounter_kind: 'rival',
      encounter_difficulty: 2,
      wild_species_pokedex_number: null,
      wild_level: null,
    })
    renderPage()

    expect(await screen.findByText('Rival')).toBeInTheDocument()
    expect(screen.queryByText(/selvagem/)).not.toBeInTheDocument()
    expect(getSpeciesByPokedexNumberMock).not.toHaveBeenCalled()
  })

  it('falls back to the plain start form when the encounter cannot be loaded', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    getCurrentEncounterMock.mockRejectedValue({ code: '42501', message: 'denied' })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Iniciar foco' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceitar encontro' })).not.toBeInTheDocument()
  })

  it('skipping the encounter falls back to the plain start form, with no battle created', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    startSessionMock.mockResolvedValue(makeSession())
    renderPage()

    await skipToPlainStartForm()
    await userEvent.click(screen.getByRole('button', { name: '45 min' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar foco' }))

    await waitFor(() =>
      expect(startSessionMock).toHaveBeenCalledWith('owner-1', {
        plannedDurationSeconds: 2700,
        taskId: null,
      }),
    )
    expect(createBattleMock).not.toHaveBeenCalled()
  })
})

describe('FocusPage — running session', () => {
  it('shows the countdown and pauses the session', async () => {
    const session = makeSession()
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    renderPage()

    expect(await screen.findByRole('timer')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running'],
        expect.objectContaining({ status: 'paused' }),
      ),
    )
  })

  it('shows the linked task title when the session has one', async () => {
    const session = makeSession({ task_id: 'task-1' })
    getActiveSessionMock.mockResolvedValue(session)
    getTaskByIdMock.mockResolvedValue({ id: 'task-1', title: 'Estudar React' } as never)
    renderPage()

    expect(await screen.findByText('Tarefa: Estudar React')).toBeInTheDocument()
  })

  it('shows a secondary indicator when the session has a linked battle', async () => {
    const session = makeSession()
    getActiveSessionMock.mockResolvedValue(session)
    getBattleForFocusSessionMock.mockResolvedValue(makeBattle())
    renderPage()

    expect(
      await screen.findByText('Encontro: Pokémon selvagem — compromisso: foco ≥ 1 min'),
    ).toBeInTheDocument()
  })

  it('cancels only after confirming', async () => {
    const session = makeSession()
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    await screen.findByRole('timer')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(transitionSessionMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running', 'paused'],
        expect.objectContaining({ status: 'cancelled' }),
      ),
    )
  })
})

describe('FocusPage — awaiting confirmation', () => {
  it('shows the confirm prompt once the planned duration has already elapsed', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    expect(
      await screen.findByText('O tempo planejado terminou. Confirma a conclusão?'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running'],
        expect.objectContaining({ status: 'completed' }),
      ),
    )
  })

  it('shows the resolved battle result (with XP) before offering a rest break', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValueOnce(session).mockResolvedValue(null)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    getBattleForFocusSessionMock.mockResolvedValue(
      makeBattle({ status: 'resolved', result: 'victory', resolved_at: new Date().toISOString() }),
    )
    listRewardEventsMock.mockResolvedValue([
      {
        id: 'r1',
        owner_id: 'owner-1',
        source_type: 'battle',
        source_id: 'battle-1',
        reward_type: 'xp',
        amount: 20,
        created_at: new Date().toISOString(),
      },
    ] as never)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar conclusão' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Pular animação' }))
    expect(await screen.findByText('Vitória contra Pokémon selvagem!')).toBeInTheDocument()
    expect(screen.getByText('+20 XP')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText('Sessão concluída! Quer descansar um pouco antes da próxima?'),
    ).toBeInTheDocument()
  })

  it('skips straight to the rest prompt when the session had no linked battle', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValueOnce(session).mockResolvedValue(null)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar conclusão' }))

    expect(
      await screen.findByText('Sessão concluída! Quer descansar um pouco antes da próxima?'),
    ).toBeInTheDocument()
  })

  it('offers an optional rest break after confirming, which can be started or skipped', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValueOnce(session).mockResolvedValue(null)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar conclusão' }))

    expect(
      await screen.findByText('Sessão concluída! Quer descansar um pouco antes da próxima?'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Descanso curto (5 min)' }))
    expect(await screen.findByRole('timer')).toHaveTextContent('05:00')

    await userEvent.click(screen.getByRole('button', { name: 'Pular descanso' }))
    await screen.findByText('Starly selvagem · Nv. 3')
  })
})

describe('FocusPage — preferences', () => {
  it('uses the stored presets instead of hardcoded ones', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    getProfileMock.mockResolvedValue(
      makeProfile({ settings: { focus: { presetsMinutes: [10, 20] } } }) as never,
    )
    renderPage()

    await skipToPlainStartForm()
    expect(screen.getByRole('button', { name: '10 min' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20 min' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '25 min' })).not.toBeInTheDocument()
  })

  it('persists the sound preference when the checkbox is toggled', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    renderPage()

    await screen.findByText('Starly selvagem · Nv. 3')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Som ao terminar' }))

    await waitFor(() =>
      expect(updateFocusPreferencesMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ soundEnabled: true }),
      ),
    )
  })
})

describe('FocusPage — history', () => {
  it('shows today and 7-day totals from completed sessions only', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    listCompletedSessionsMock.mockResolvedValue([
      makeSession({ status: 'completed', ended_at: twoDaysAgo, planned_duration_seconds: 1500 }),
    ] as never)
    renderPage()

    expect(await screen.findByText('0 sessões · 0 min')).toBeInTheDocument()
    expect(screen.getByText('1 sessão · 25 min')).toBeInTheDocument()
  })
})
