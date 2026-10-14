import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGameProgress } from '@/features/journey/api/game-progress-repository'
import { DashboardPage } from './DashboardPage'

vi.mock('@/features/journey/api/game-progress-repository', () => ({
  getGameProgress: vi.fn(),
  chooseStarter: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  listSpeciesCatalog: vi.fn(() =>
    Promise.resolve([
      {
        pokedex_number: 387,
        name: 'Turtwig',
        types: ['grass'],
        sprite_url: null,
        official_artwork_url: null,
        is_starter: true,
        is_legendary: false,
        evolves_to_pokedex_number: null,
        evolution_min_level: 18,
        catalog_version: 1,
        imported_at: '2026-10-13T00:00:00Z',
      },
    ]),
  ),
  getSpeciesByPokedexNumber: vi.fn(),
}))

const getGameProgressMock = vi.mocked(getGameProgress)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getGameProgressMock.mockReset()
})

describe('DashboardPage', () => {
  it('renders the dashboard heading', () => {
    getGameProgressMock.mockResolvedValue(null)
    renderPage()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('invites a new player to choose a starter', async () => {
    getGameProgressMock.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('Escolha seu Pokémon inicial')).toBeInTheDocument()
  })

  it('does not show the starter choice once one was chosen', async () => {
    getGameProgressMock.mockResolvedValue({
      owner_id: 'owner-1',
      starter_pokedex_number: 387,
      starter_owned_pokemon_id: 'p1',
      starter_chosen_at: '2026-10-13T00:00:00Z',
    })
    renderPage()
    await vi.waitFor(() => expect(getGameProgressMock).toHaveBeenCalled())
    expect(screen.queryByText('Escolha seu Pokémon inicial')).not.toBeInTheDocument()
  })
})
