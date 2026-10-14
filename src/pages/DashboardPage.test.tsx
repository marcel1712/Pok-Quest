import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  getActiveSession,
  listCompletedSessions,
} from '@/features/focus/api/focus-sessions-repository'
import {
  getCampaignContent,
  getCurrentEncounter,
  listBadges,
  listCampaignProgress,
} from '@/features/journey/api/campaign-repository'
import { getGameProgress } from '@/features/journey/api/game-progress-repository'
import { listOwnedPokemon } from '@/features/pokemon/api/owned-pokemon-repository'
import {
  getSpeciesByPokedexNumber,
  listSpeciesCatalog,
} from '@/features/pokemon/api/species-catalog-repository'
import { getProfile } from '@/features/settings/api/profile-repository'
import { createTask, listTasks, updateTask } from '@/features/tasks/api/tasks-repository'
import { todayIsoDate } from '@/features/tasks/scheduling'
import type { Task } from '@/features/tasks/types'
import { DashboardPage } from './DashboardPage'

vi.mock('@/features/tasks/api/tasks-repository', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTaskById: vi.fn(),
}))
vi.mock('@/features/focus/api/focus-sessions-repository', () => ({
  getActiveSession: vi.fn(),
  listCompletedSessions: vi.fn(),
  startSession: vi.fn(),
  transitionSession: vi.fn(),
}))
vi.mock('@/features/settings/api/profile-repository', () => ({
  getProfile: vi.fn(),
  updateFocusPreferences: vi.fn(),
}))
vi.mock('@/features/journey/api/campaign-repository', () => ({
  getCampaignContent: vi.fn(),
  listCampaignProgress: vi.fn(),
  getCurrentEncounter: vi.fn(),
  listBadges: vi.fn(),
}))
vi.mock('@/features/journey/api/game-progress-repository', () => ({
  getGameProgress: vi.fn(),
  chooseStarter: vi.fn(),
}))
vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  listSpeciesCatalog: vi.fn(),
  getSpeciesByPokedexNumber: vi.fn(),
}))
vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  listOwnedPokemon: vi.fn(),
  setPartyPosition: vi.fn(),
  swapPartyPositions: vi.fn(),
  confirmEvolution: vi.fn(),
  captureFromBattle: vi.fn(),
  getCaptureForBattle: vi.fn(),
}))

const listTasksMock = vi.mocked(listTasks)
const createTaskMock = vi.mocked(createTask)
const updateTaskMock = vi.mocked(updateTask)
const getActiveSessionMock = vi.mocked(getActiveSession)
const listCompletedSessionsMock = vi.mocked(listCompletedSessions)
const getProfileMock = vi.mocked(getProfile)
const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)
const getCurrentEncounterMock = vi.mocked(getCurrentEncounter)
const listBadgesMock = vi.mocked(listBadges)
const getGameProgressMock = vi.mocked(getGameProgress)
const listSpeciesCatalogMock = vi.mocked(listSpeciesCatalog)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)
const listOwnedPokemonMock = vi.mocked(listOwnedPokemon)

const TODAY = todayIsoDate()

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    owner_id: 'owner-1',
    title: `Tarefa ${id}`,
    description: null,
    category_id: null,
    difficulty: 2,
    due_date: null,
    status: 'pending',
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function species(pokedexNumber: number, name: string) {
  return {
    pokedex_number: pokedexNumber,
    name,
    types: ['normal'],
    sprite_url: null,
    official_artwork_url: null,
    animated_sprite_url: null,
    is_starter: pokedexNumber === 390,
    is_legendary: false,
    evolves_to_pokedex_number: null,
    evolution_min_level: null,
    catalog_version: 2,
    imported_at: '2026-10-13T00:00:00Z',
  }
}

function node(id: string, sortOrder: number, title: string, badgeName: string | null = null) {
  return {
    id,
    region_id: 'sinnoh',
    sort_order: sortOrder,
    kind: badgeName ? 'gym' : 'route',
    title,
    summary: 'Resumo',
    npc_name: null,
    encounter_kind: badgeName ? 'gymLeader' : 'wild',
    encounter_difficulty: 1,
    required_victories: 1,
    repeatable: !badgeName,
    badge_name: badgeName,
    scene_intro: [],
    scene_outro: [],
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', session: { user: { id: 'owner-1' } } as never })

  listTasksMock
    .mockReset()
    .mockResolvedValue([
      makeTask('hoje', { title: 'Entregar relatório', due_date: TODAY }),
      makeTask('solta', { title: 'Organizar mesa' }),
      makeTask('futura', { title: 'Planejar viagem', due_date: '2999-01-01' }),
    ])
  createTaskMock.mockReset()
  updateTaskMock.mockReset()
  getActiveSessionMock.mockReset().mockResolvedValue(null)
  listCompletedSessionsMock.mockReset().mockResolvedValue([])
  getProfileMock.mockReset().mockResolvedValue({
    id: 'owner-1',
    timezone: 'UTC',
    settings: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as never)
  getCampaignContentMock.mockReset().mockResolvedValue({
    nodes: [
      node('sinnoh.town', 1, 'Twinleaf Town'),
      node('sinnoh.route-201', 2, 'Rota 201'),
      node('sinnoh.gym', 3, 'Ginásio de Oreburgh', 'Insígnia do Carvão'),
      node('sinnoh.route-204', 4, 'Rota 204'),
    ],
    prerequisites: [
      { node_id: 'sinnoh.route-201', requires_node_id: 'sinnoh.town' },
      { node_id: 'sinnoh.gym', requires_node_id: 'sinnoh.route-201' },
      { node_id: 'sinnoh.route-204', requires_node_id: 'sinnoh.gym' },
    ],
  })
  listCampaignProgressMock.mockReset().mockResolvedValue([
    {
      owner_id: 'owner-1',
      node_id: 'sinnoh.town',
      victories: 1,
      completed_at: '2026-10-13T00:00:00Z',
    },
  ])
  getCurrentEncounterMock.mockReset().mockResolvedValue({
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
  })
  listBadgesMock.mockReset().mockResolvedValue([])
  getGameProgressMock.mockReset().mockResolvedValue({
    owner_id: 'owner-1',
    starter_pokedex_number: 390,
    starter_owned_pokemon_id: 'p1',
    starter_chosen_at: '2026-10-13T00:00:00Z',
  })
  listSpeciesCatalogMock
    .mockReset()
    .mockResolvedValue([species(390, 'Chimchar'), species(396, 'Starly')])
  getSpeciesByPokedexNumberMock.mockReset().mockResolvedValue({
    ...species(396, 'Starly'),
    sprite_url: 'https://example.com/396.png',
    animated_sprite_url: 'https://example.com/396.gif',
  })
  listOwnedPokemonMock.mockReset().mockResolvedValue([
    {
      id: 'p1',
      owner_id: 'owner-1',
      pokedex_number: 390,
      nickname: null,
      level: 7,
      xp: 400,
      party_position: 1,
      pending_evolution_to_pokedex_number: null,
      captured_at: '2026-10-13T00:00:00Z',
      created_at: '2026-10-13T00:00:00Z',
      updated_at: '2026-10-13T00:00:00Z',
    },
  ])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DashboardPage', () => {
  it('shows skeletons first, then every section with real data', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Carregando tarefas…')).toBeInTheDocument()

    // Tasks: today first, the future one left out, counts for both groups.
    const tasks = await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    expect(within(tasks).getAllByRole('listitem')).toHaveLength(2)
    expect(within(tasks).getAllByRole('listitem')[0]).toHaveTextContent('Entregar relatório')
    expect(screen.queryByText('Planejar viagem')).not.toBeInTheDocument()
    expect(screen.getByText('1 para hoje · 1 pendente')).toBeInTheDocument()

    // Focus: the stored next encounter, and one obvious action.
    expect(await screen.findByText('Starly selvagem · Nv. 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar foco' })).toHaveAttribute('href', '/focus')
    expect(screen.getByRole('img', { name: 'Starly' })).toHaveAttribute(
      'src',
      'https://example.com/396.gif',
    )

    // Team and journey summaries.
    const team = await screen.findByRole('list', { name: 'Time ativo' })
    expect(within(team).getByText('Chimchar')).toBeInTheDocument()
    expect(within(team).getByText('Nv. 7')).toBeInTheDocument()
    expect(await screen.findByText('1 de 4 etapas · 0/1 insígnias')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('reuses the Tasks page query instead of fetching its own slice', async () => {
    renderPage()

    await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    expect(listTasksMock).toHaveBeenCalledTimes(1)
    expect(listTasksMock).toHaveBeenCalledWith({ status: 'pending' })
  })

  it('updates the list and the counts as soon as a task is completed', async () => {
    updateTaskMock.mockImplementation(async () => {
      listTasksMock.mockResolvedValue([makeTask('solta', { title: 'Organizar mesa' })])
      return makeTask('hoje', { status: 'completed' })
    })
    renderPage()

    const tasks = await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    await userEvent.click(within(tasks).getAllByRole('button', { name: 'Concluir tarefa' })[0]!)

    await waitFor(() => expect(screen.getByText('0 para hoje · 1 pendente')).toBeInTheDocument())
    expect(screen.queryByText('Entregar relatório')).not.toBeInTheDocument()
    expect(updateTaskMock).toHaveBeenCalledWith(
      'hoje',
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('creates a task without leaving the dashboard', async () => {
    createTaskMock.mockResolvedValue(makeTask('nova'))
    renderPage()

    await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    await userEvent.type(screen.getByRole('textbox', { name: /título|tarefa/i }), 'Ler capítulo 3')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))

    await waitFor(() =>
      expect(createTaskMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ title: 'Ler capítulo 3' }),
      ),
    )
  })

  it('caps a very long task list and says how many are left on the Tasks page', async () => {
    listTasksMock.mockResolvedValue(
      Array.from({ length: 200 }, (_, index) => makeTask(`t${index}`)),
    )
    renderPage()

    const tasks = await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    expect(within(tasks).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('+ 195 em Tarefas')).toBeInTheDocument()
    expect(screen.getByText('0 para hoje · 200 pendentes')).toBeInTheDocument()
  })

  it('points back to a session that is already running', async () => {
    getActiveSessionMock.mockResolvedValue({
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
    })
    renderPage()

    expect(await screen.findByText(/Sessão em andamento · faltam 2\d:\d\d/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar à sessão' })).toHaveAttribute('href', '/focus')
    expect(screen.queryByRole('link', { name: 'Iniciar foco' })).not.toBeInTheDocument()
  })

  it('keeps the other sections working when one fails, and lets it be retried', async () => {
    listTasksMock.mockRejectedValueOnce({ code: '42501', message: 'denied' })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Você não tem permissão para fazer essa ação.')
    expect(await screen.findByText('Starly selvagem · Nv. 3')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Time ativo' })).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('list', { name: 'Tarefas prioritárias' })).toBeInTheDocument()
  })

  it('invites a player with an empty team to get a Pokémon, and offers the starter choice', async () => {
    listOwnedPokemonMock.mockResolvedValue([])
    getGameProgressMock.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText(/Seu time está vazio/)).toBeInTheDocument()
    expect(await screen.findByText('Escolha seu Pokémon inicial')).toBeInTheDocument()
  })

  it('warns when the browser goes offline and clears the warning when it is back', async () => {
    renderPage()
    await screen.findByRole('list', { name: 'Tarefas prioritárias' })
    expect(screen.queryByText(/Você está offline/)).not.toBeInTheDocument()

    setOnline(false)
    expect(screen.getByText(/Você está offline/)).toBeInTheDocument()
    // Cached data stays on screen.
    expect(screen.getByText('Entregar relatório')).toBeInTheDocument()

    setOnline(true)
    expect(screen.queryByText(/Você está offline/)).not.toBeInTheDocument()
  })
})
