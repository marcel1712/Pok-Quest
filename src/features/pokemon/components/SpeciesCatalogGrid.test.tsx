import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listSpeciesCatalog } from '@/features/pokemon/api/species-catalog-repository'
import { SpeciesCatalogGrid } from './SpeciesCatalogGrid'

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  listSpeciesCatalog: vi.fn(),
}))

const listSpeciesCatalogMock = vi.mocked(listSpeciesCatalog)

function renderGrid() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SpeciesCatalogGrid />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listSpeciesCatalogMock.mockReset()
})

describe('SpeciesCatalogGrid', () => {
  it('renders each species with its types and starter marker', async () => {
    listSpeciesCatalogMock.mockResolvedValue([
      {
        pokedex_number: 387,
        name: 'Turtwig',
        types: ['grass'],
        sprite_url: null,
        official_artwork_url: null,
        animated_sprite_url: null,
        is_starter: true,
        is_legendary: false,
        evolves_to_pokedex_number: 388,
        evolution_min_level: 18,
        catalog_version: 1,
        imported_at: new Date().toISOString(),
      },
    ] as never)
    renderGrid()

    expect(await screen.findByText('Turtwig')).toBeInTheDocument()
    expect(screen.getByText('grass')).toBeInTheDocument()
    expect(screen.getByText('Inicial')).toBeInTheDocument()
  })

  it('shows an empty state when the catalog has nothing', async () => {
    listSpeciesCatalogMock.mockResolvedValue([])
    renderGrid()

    expect(await screen.findByText('Nenhuma espécie no catálogo ainda.')).toBeInTheDocument()
  })

  it('shows an error state when the query fails', async () => {
    listSpeciesCatalogMock.mockRejectedValue(new Error('network down'))
    renderGrid()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
