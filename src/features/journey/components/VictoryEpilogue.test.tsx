import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Battle } from '@/features/battles/types'
import { getCampaignContent, listBadges, listCampaignProgress } from '../api/campaign-repository'
import type { CampaignNode } from '../types'
import { VictoryEpilogue } from './VictoryEpilogue'

vi.mock('../api/campaign-repository', () => ({
  getCampaignContent: vi.fn(),
  listCampaignProgress: vi.fn(),
  listBadges: vi.fn(),
  getCurrentEncounter: vi.fn(),
}))

const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)
const listBadgesMock = vi.mocked(listBadges)

const gym: CampaignNode = {
  id: 'sinnoh.oreburgh-gym',
  region_id: 'sinnoh',
  sort_order: 1,
  kind: 'gym',
  title: 'Ginásio de Oreburgh',
  summary: 'Resumo',
  npc_name: 'Roark',
  encounter_kind: 'gymLeader',
  encounter_difficulty: 3,
  required_victories: 1,
  repeatable: false,
  badge_name: 'Insígnia do Carvão',
  scene_intro: ['Roark tira o capacete.'],
  scene_outro: ['Roark: "Esta agora é sua."'],
}

function battle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'battle-1',
    owner_id: 'owner-1',
    encounter_kind: 'gymLeader',
    encounter_difficulty: 3,
    commitment_type: 'focusSession',
    commitment_min_difficulty: null,
    commitment_min_duration_minutes: 3,
    task_id: null,
    focus_session_id: 'session-1',
    status: 'resolved',
    result: 'victory',
    team_multiplier_applied: 1,
    wild_species_pokedex_number: null,
    wild_level: null,
    campaign_node_id: gym.id,
    encounter_id: 'encounter-1',
    created_at: '2026-10-13T00:00:00Z',
    resolved_at: '2026-10-13T00:05:00Z',
    ...overrides,
  }
}

const completed = [
  { owner_id: 'owner-1', node_id: gym.id, victories: 1, completed_at: '2026-10-13T00:05:00Z' },
]
const earned = [
  {
    owner_id: 'owner-1',
    node_id: gym.id,
    battle_id: 'battle-1',
    earned_at: '2026-10-13T00:05:00Z',
  },
]

function renderEpilogue(forBattle: Battle) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <VictoryEpilogue battle={forBattle} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getCampaignContentMock.mockReset().mockResolvedValue({ nodes: [gym], prerequisites: [] })
  listCampaignProgressMock.mockReset().mockResolvedValue(completed)
  listBadgesMock.mockReset().mockResolvedValue(earned)
})

describe('VictoryEpilogue', () => {
  it('announces the badge earned by this battle and plays the closing scene', async () => {
    renderEpilogue(battle())

    expect(await screen.findByText('Você conquistou a Insígnia do Carvão!')).toBeInTheDocument()
    expect(screen.getByText('Roark: "Esta agora é sua."')).toBeInTheDocument()
  })

  it('does not announce a badge that was credited to a different battle', async () => {
    renderEpilogue(battle({ id: 'battle-2' }))

    expect(await screen.findByText('Roark: "Esta agora é sua."')).toBeInTheDocument()
    expect(screen.queryByText(/Você conquistou/)).not.toBeInTheDocument()
  })

  it('shows nothing for a battle that was not won', async () => {
    const { container } = renderEpilogue(battle({ result: 'withdrawal' }))

    await waitFor(() => expect(listBadgesMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('holds the closing scene back while the node is still in progress', async () => {
    listCampaignProgressMock.mockResolvedValue([])
    listBadgesMock.mockResolvedValue([])
    const { container } = renderEpilogue(battle())

    await waitFor(() => expect(listCampaignProgressMock).toHaveBeenCalled())
    await waitFor(() => expect(getCampaignContentMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
