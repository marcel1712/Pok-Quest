import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmEvolution, listOwnedPokemon } from '@/features/pokemon/api/owned-pokemon-repository'
import {
  getSpeciesByPokedexNumber,
  listSpeciesCatalog,
} from '@/features/pokemon/api/species-catalog-repository'
import type { OwnedPokemon } from '@/features/pokemon/types'
import { TeamPage } from './TeamPage'

vi.mock('@/features/journey/api/game-progress-repository', () => ({
  getGameProgress: vi.fn(() => Promise.resolve({ starter_pokedex_number: 390 })),
  chooseStarter: vi.fn(),
}))

vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  listOwnedPokemon: vi.fn(),
  setPartyPosition: vi.fn(),
  swapPartyPositions: vi.fn(),
  confirmEvolution: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  getSpeciesByPokedexNumber: vi.fn(),
  listSpeciesCatalog: vi.fn(),
}))

const listOwnedPokemonMock = vi.mocked(listOwnedPokemon)
const confirmEvolutionMock = vi.mocked(confirmEvolution)
const getSpeciesByPokedexNumberMock = vi.mocked(getSpeciesByPokedexNumber)
const listSpeciesCatalogMock = vi.mocked(listSpeciesCatalog)

function makePokemon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: 'p1',
    owner_id: 'owner-1',
    pokedex_number: 387,
    nickname: null,
    level: 32,
    xp: 32817,
    party_position: 1,
    pending_evolution_to_pokedex_number: null,
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listOwnedPokemonMock.mockReset()
  confirmEvolutionMock.mockReset()
  // The Team page loads the whole catalog for its Pokédex grid; every species shown
  // elsewhere on the page is read from that one response.
  listSpeciesCatalogMock
    .mockReset()
    .mockResolvedValue([makeSpecies(387, 'Turtwig'), makeSpecies(389, 'Torterra')] as never)
  getSpeciesByPokedexNumberMock
    .mockReset()
    .mockImplementation(
      (pokedexNumber) =>
        Promise.resolve(
          pokedexNumber === 387 ? makeSpecies(387, 'Turtwig') : makeSpecies(389, 'Torterra'),
        ) as never,
    )
})

describe('TeamPage', () => {
  it('shows an evolution prompt for a pokemon with a pending evolution', async () => {
    listOwnedPokemonMock.mockResolvedValue([
      makePokemon({ pending_evolution_to_pokedex_number: 389 }),
    ])
    renderPage()

    expect(
      await screen.findByText('Turtwig está pronto para evoluir para Torterra!'),
    ).toBeInTheDocument()
    expect(listSpeciesCatalogMock).toHaveBeenCalledTimes(1)
    expect(getSpeciesByPokedexNumberMock).not.toHaveBeenCalled()
  })

  it('confirms the evolution from the team page', async () => {
    listOwnedPokemonMock.mockResolvedValue([
      makePokemon({ pending_evolution_to_pokedex_number: 389 }),
    ])
    confirmEvolutionMock.mockResolvedValue(makePokemon({ pokedex_number: 389 }) as never)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Evoluir agora' }))
    expect(confirmEvolutionMock).toHaveBeenCalledWith('p1')
  })

  it('shows no evolution prompt when nothing is pending', async () => {
    listOwnedPokemonMock.mockResolvedValue([makePokemon()])
    renderPage()

    expect((await screen.findAllByText('Turtwig')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/pronto para evoluir/)).not.toBeInTheDocument()
  })
})
