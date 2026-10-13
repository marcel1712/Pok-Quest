import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listSpeciesCatalog } from '@/features/pokemon/api/species-catalog-repository'
import { chooseStarter, getGameProgress } from '../api/game-progress-repository'
import type { GameProgress } from '../types'
import { StarterOnboarding } from './StarterOnboarding'

vi.mock('../api/game-progress-repository', () => ({
  getGameProgress: vi.fn(),
  chooseStarter: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  listSpeciesCatalog: vi.fn(),
  getSpeciesByPokedexNumber: vi.fn(),
}))

const getGameProgressMock = vi.mocked(getGameProgress)
const chooseStarterMock = vi.mocked(chooseStarter)
const listSpeciesCatalogMock = vi.mocked(listSpeciesCatalog)

function species(pokedexNumber: number, name: string, type: string, isStarter: boolean) {
  return {
    pokedex_number: pokedexNumber,
    name,
    types: [type],
    sprite_url: null,
    official_artwork_url: null,
    is_starter: isStarter,
    evolves_to_pokedex_number: null,
    evolution_min_level: isStarter ? 16 : null,
    catalog_version: 1,
    imported_at: '2026-10-13T00:00:00Z',
  }
}

const chosen: GameProgress = {
  owner_id: 'owner-1',
  starter_pokedex_number: 390,
  starter_owned_pokemon_id: 'p1',
  starter_chosen_at: '2026-10-13T00:00:00Z',
}

function renderOnboarding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <StarterOnboarding />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getGameProgressMock.mockReset().mockResolvedValue(null)
  chooseStarterMock.mockReset()
  listSpeciesCatalogMock
    .mockReset()
    .mockResolvedValue([
      species(387, 'Turtwig', 'grass', true),
      species(390, 'Chimchar', 'fire', true),
      species(393, 'Piplup', 'water', true),
      species(399, 'Bidoof', 'normal', false),
    ])
})

describe('StarterOnboarding', () => {
  it('offers only the three starters, with their types', async () => {
    renderOnboarding()

    expect(await screen.findAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Turtwig.*Tipo Planta/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Chimchar.*Tipo Fogo/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Piplup.*Tipo Água/ })).toBeInTheDocument()
    expect(screen.queryByText('Bidoof')).not.toBeInTheDocument()
  })

  it('requires an explicit selection before confirming', async () => {
    renderOnboarding()

    await screen.findAllByRole('radio')
    expect(screen.getByRole('button', { name: 'Selecione um Pokémon' })).toBeDisabled()
    expect(chooseStarterMock).not.toHaveBeenCalled()
  })

  it('confirms the selected starter and disappears once the choice is recorded', async () => {
    chooseStarterMock.mockImplementation(async () => {
      getGameProgressMock.mockResolvedValue(chosen)
      return { id: 'p1' } as never
    })
    renderOnboarding()

    await userEvent.click(await screen.findByRole('radio', { name: /Chimchar/ }))
    expect(screen.getByRole('radio', { name: /Chimchar/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Começar com Chimchar' }))

    expect(chooseStarterMock).toHaveBeenCalledWith(390)
    await waitFor(() =>
      expect(screen.queryByText('Escolha seu Pokémon inicial')).not.toBeInTheDocument(),
    )
  })

  it('sends the choice only once when the confirm button is clicked repeatedly', async () => {
    let resolveChoice: (value: never) => void = () => {}
    chooseStarterMock.mockReturnValue(
      new Promise((resolve) => {
        resolveChoice = resolve
      }),
    )
    renderOnboarding()

    await userEvent.click(await screen.findByRole('radio', { name: /Piplup/ }))
    const confirm = screen.getByRole('button', { name: 'Começar com Piplup' })
    await userEvent.click(confirm)
    await userEvent.click(confirm)
    await userEvent.click(confirm)

    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled()
    expect(chooseStarterMock).toHaveBeenCalledTimes(1)
    resolveChoice({ id: 'p1' } as never)
  })

  it('renders nothing when a starter was already chosen (e.g. after a reload)', async () => {
    getGameProgressMock.mockResolvedValue(chosen)
    const { container } = renderOnboarding()

    await waitFor(() => expect(getGameProgressMock).toHaveBeenCalled())
    await waitFor(() => expect(listSpeciesCatalogMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('hides itself, without an error, when the server says a starter already exists', async () => {
    chooseStarterMock.mockImplementation(async () => {
      getGameProgressMock.mockResolvedValue(chosen)
      throw { code: '23505', message: 'duplicate key' }
    })
    renderOnboarding()

    await userEvent.click(await screen.findByRole('radio', { name: /Turtwig/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Começar com Turtwig' }))

    await waitFor(() =>
      expect(screen.queryByText('Escolha seu Pokémon inicial')).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error and keeps the selection when the choice fails', async () => {
    chooseStarterMock.mockRejectedValue(new Error('Sem conexão.'))
    renderOnboarding()

    await userEvent.click(await screen.findByRole('radio', { name: /Turtwig/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Começar com Turtwig' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.')
    expect(screen.getByRole('button', { name: 'Começar com Turtwig' })).toBeEnabled()
  })

  it('renders nothing when the starter status cannot be loaded', async () => {
    getGameProgressMock.mockRejectedValue(new Error('offline'))
    const { container } = renderOnboarding()

    await waitFor(() => expect(getGameProgressMock).toHaveBeenCalled())
    await waitFor(() => expect(listSpeciesCatalogMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
