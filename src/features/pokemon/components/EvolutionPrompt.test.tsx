import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmEvolution } from '@/features/pokemon/api/owned-pokemon-repository'
import { getSpeciesByPokedexNumber } from '@/features/pokemon/api/species-catalog-repository'
import type { OwnedPokemon } from '@/features/pokemon/types'
import { EvolutionPrompt } from './EvolutionPrompt'

vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  confirmEvolution: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  getSpeciesByPokedexNumber: vi.fn(),
}))

const confirmEvolutionMock = vi.mocked(confirmEvolution)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)

function makePokemon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: 'p1',
    owner_id: 'owner-1',
    pokedex_number: 387,
    nickname: null,
    level: 32,
    xp: 32817,
    party_position: 1,
    pending_evolution_to_pokedex_number: 389,
    captured_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeSpecies(pokedexNumber: number, name: string) {
  return {
    pokedex_number: pokedexNumber,
    name,
    types: ['grass'],
    sprite_url: null,
    official_artwork_url: null,
    animated_sprite_url: null,
    is_starter: pokedexNumber === 387,
    is_legendary: false,
    evolves_to_pokedex_number: null,
    evolution_min_level: null,
    catalog_version: 1,
    imported_at: new Date().toISOString(),
  }
}

function renderPrompt(pokemon: OwnedPokemon) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EvolutionPrompt pokemon={pokemon} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  confirmEvolutionMock.mockReset()
  getSpeciesByPokedexNumberMock
    .mockReset()
    .mockImplementation(
      (pokedexNumber) =>
        Promise.resolve(
          pokedexNumber === 387 ? makeSpecies(387, 'Turtwig') : makeSpecies(389, 'Torterra'),
        ) as never,
    )
})

describe('EvolutionPrompt', () => {
  it('shows the current and target species, offering to evolve now', async () => {
    renderPrompt(makePokemon())

    expect(
      await screen.findByText('Turtwig está pronto para evoluir para Torterra!'),
    ).toBeInTheDocument()
  })

  it('calls confirmEvolution with the pokemon id when confirmed', async () => {
    confirmEvolutionMock.mockResolvedValue(makePokemon({ pokedex_number: 389 }) as never)
    renderPrompt(makePokemon())

    await userEvent.click(await screen.findByRole('button', { name: 'Evoluir agora' }))
    expect(confirmEvolutionMock).toHaveBeenCalledWith('p1')
  })

  it('hides itself when "Depois" is clicked, without calling confirmEvolution', async () => {
    renderPrompt(makePokemon())

    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }))

    expect(screen.queryByText(/pronto para evoluir/)).not.toBeInTheDocument()
    expect(confirmEvolutionMock).not.toHaveBeenCalled()
  })

  it('renders nothing when there is no pending evolution', () => {
    renderPrompt(makePokemon({ pending_evolution_to_pokedex_number: null }))
    expect(screen.queryByText(/pronto para evoluir/)).not.toBeInTheDocument()
  })
})
