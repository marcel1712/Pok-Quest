import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureFromBattle,
  getCaptureForBattle,
} from '@/features/pokemon/api/owned-pokemon-repository'
import { getSpeciesByPokedexNumber } from '@/features/pokemon/api/species-catalog-repository'
import { listRewardEvents } from '@/features/rewards/api/reward-events-repository'
import type { Battle } from '../types'
import { BattleResultCard } from './BattleResultCard'

vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  captureFromBattle: vi.fn(),
  getCaptureForBattle: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  getSpeciesByPokedexNumber: vi.fn(),
}))

vi.mock('@/features/rewards/api/reward-events-repository', () => ({
  listRewardEvents: vi.fn(),
}))

const captureFromBattleMock = vi.mocked(captureFromBattle)
const getCaptureForBattleMock = vi.mocked(getCaptureForBattle)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)
const listRewardEventsMock = vi.mocked(listRewardEvents)

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'battle-1',
    owner_id: 'owner-1',
    encounter_kind: 'trainer',
    encounter_difficulty: 3,
    commitment_type: 'task',
    commitment_min_difficulty: 3,
    commitment_min_duration_minutes: null,
    task_id: 'task-1',
    focus_session_id: null,
    status: 'resolved',
    result: 'victory',
    team_multiplier_applied: 1,
    wild_species_pokedex_number: null,
    campaign_node_id: null,
    encounter_id: null,
    wild_level: null,
    created_at: new Date().toISOString(),
    resolved_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderCard(battle: Battle, onDismiss = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BattleResultCard battle={battle} onDismiss={onDismiss} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listRewardEventsMock.mockReset().mockResolvedValue([])
  captureFromBattleMock.mockReset()
  getCaptureForBattleMock.mockReset().mockResolvedValue(null)
  getSpeciesByPokedexNumberMock.mockReset().mockResolvedValue(null)
})

describe('BattleResultCard', () => {
  it('shows the victory message and XP total for a victory', async () => {
    listRewardEventsMock.mockResolvedValue([
      {
        id: 'r1',
        owner_id: 'owner-1',
        source_type: 'battle',
        source_id: 'battle-1',
        reward_type: 'xp',
        amount: 60,
        created_at: new Date().toISOString(),
      },
    ] as never)
    renderCard(makeBattle())

    expect(await screen.findByText('Vitória contra Treinador!')).toBeInTheDocument()
    expect(await screen.findByText('+60 XP')).toBeInTheDocument()
    expect(screen.getByText('Compromisso cumprido: tarefa de dificuldade ≥ 3.')).toBeInTheDocument()
  })

  it('shows the withdrawal message with no XP line at all', async () => {
    renderCard(makeBattle({ result: 'withdrawal' }))

    expect(await screen.findByText('Encontro não concluído')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d+ XP$/)).not.toBeInTheDocument()
  })

  it('calls onDismiss when continuing', async () => {
    const onDismiss = vi.fn()
    renderCard(makeBattle(), onDismiss)

    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe('BattleResultCard — capture', () => {
  function makeSpecies() {
    return {
      pokedex_number: 399,
      name: 'Bidoof',
      types: ['normal'],
      sprite_url: null,
      official_artwork_url: null,
      animated_sprite_url: null,
      is_starter: false,
      is_legendary: false,
      evolves_to_pokedex_number: 400,
      evolution_min_level: 15,
      catalog_version: 1,
      imported_at: new Date().toISOString(),
    }
  }

  it('offers to capture after a wild victory and hides the button once captured', async () => {
    getSpeciesByPokedexNumberMock.mockResolvedValue(makeSpecies() as never)
    captureFromBattleMock.mockResolvedValue({ id: 'owned-1' } as never)
    getCaptureForBattleMock.mockResolvedValueOnce(null).mockResolvedValue({
      id: 'c1',
      owner_id: 'owner-1',
      battle_id: 'battle-1',
      pokedex_number: 399,
      owned_pokemon_id: 'owned-1',
      created_at: new Date().toISOString(),
    } as never)
    renderCard(makeBattle({ encounter_kind: 'wild', wild_species_pokedex_number: 399 }))

    expect(await screen.findByText('Um Bidoof apareceu!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Capturar' }))

    expect(await screen.findByText('Bidoof capturado!')).toBeInTheDocument()
    expect(captureFromBattleMock).toHaveBeenCalledWith('battle-1')
    expect(screen.queryByRole('button', { name: 'Capturar' })).not.toBeInTheDocument()
  })

  it('shows the already-captured state without a capture button when reopened', async () => {
    getSpeciesByPokedexNumberMock.mockResolvedValue(makeSpecies() as never)
    getCaptureForBattleMock.mockResolvedValue({
      id: 'c1',
      owner_id: 'owner-1',
      battle_id: 'battle-1',
      pokedex_number: 399,
      owned_pokemon_id: 'owned-1',
      created_at: new Date().toISOString(),
    } as never)
    renderCard(makeBattle({ encounter_kind: 'wild', wild_species_pokedex_number: 399 }))

    expect(await screen.findByText('Bidoof capturado!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Capturar' })).not.toBeInTheDocument()
  })

  it('does not offer capture for a non-wild encounter even on victory', async () => {
    renderCard(makeBattle({ encounter_kind: 'trainer', wild_species_pokedex_number: null }))

    await screen.findByText('Vitória contra Treinador!')
    expect(screen.queryByRole('button', { name: 'Capturar' })).not.toBeInTheDocument()
  })
})
