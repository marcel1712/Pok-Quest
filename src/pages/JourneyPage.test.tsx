import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCampaignContent,
  listCampaignProgress,
} from '@/features/journey/api/campaign-repository'
import type { CampaignContent, CampaignNode } from '@/features/journey/types'
import { JourneyPage } from './JourneyPage'

vi.mock('@/features/journey/api/game-progress-repository', () => ({
  getGameProgress: vi.fn(() => Promise.resolve({ starter_pokedex_number: 390 })),
  chooseStarter: vi.fn(),
}))

vi.mock('@/features/pokemon/api/species-catalog-repository', () => ({
  listSpeciesCatalog: vi.fn(() => Promise.resolve([])),
  getSpeciesByPokedexNumber: vi.fn(),
}))

vi.mock('@/features/journey/api/campaign-repository', () => ({
  getCampaignContent: vi.fn(),
  listCampaignProgress: vi.fn(),
}))

const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)

function node(overrides: Partial<CampaignNode> & { id: string; sort_order: number }): CampaignNode {
  return {
    region_id: 'sinnoh',
    kind: 'route',
    title: overrides.id,
    summary: 'Resumo',
    npc_name: null,
    encounter_kind: 'wild',
    encounter_difficulty: 1,
    required_victories: 3,
    repeatable: true,
    ...overrides,
  }
}

const content: CampaignContent = {
  nodes: [
    node({
      id: 'sinnoh.town',
      sort_order: 1,
      kind: 'story',
      title: 'Twinleaf Town',
      encounter_kind: 'milestone',
      required_victories: 1,
      repeatable: false,
    }),
    node({ id: 'sinnoh.route', sort_order: 2, title: 'Rota 201', summary: 'Grama alta.' }),
    node({
      id: 'sinnoh.gym',
      sort_order: 3,
      kind: 'gym',
      title: 'Ginásio de Oreburgh',
      summary: 'Segredo do ginásio.',
      npc_name: 'Roark',
      encounter_kind: 'gymLeader',
      encounter_difficulty: 3,
      required_victories: 1,
      repeatable: false,
    }),
  ],
  prerequisites: [
    { node_id: 'sinnoh.route', requires_node_id: 'sinnoh.town' },
    { node_id: 'sinnoh.gym', requires_node_id: 'sinnoh.route' },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <JourneyPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getCampaignContentMock.mockReset().mockResolvedValue(content)
  listCampaignProgressMock.mockReset().mockResolvedValue([])
})

describe('JourneyPage', () => {
  it('shows completed, in-progress and locked steps with their progress', async () => {
    listCampaignProgressMock.mockResolvedValue([
      {
        owner_id: 'owner-1',
        node_id: 'sinnoh.town',
        victories: 1,
        completed_at: '2026-10-13T00:00:00Z',
      },
      { owner_id: 'owner-1', node_id: 'sinnoh.route', victories: 2, completed_at: null },
    ])
    renderPage()

    expect(await screen.findByText('1 de 3 etapas concluídas')).toBeInTheDocument()
    const [town, route, gym] = screen.getAllByRole('listitem')

    expect(within(town!).getByText('Concluído')).toBeInTheDocument()
    expect(within(town!).getByText(/1\/1 vitória/)).toBeInTheDocument()

    expect(route).toHaveAttribute('aria-current', 'step')
    expect(within(route!).getByText('Próximo encontro')).toBeInTheDocument()
    expect(within(route!).getByText(/2\/3 vitórias/)).toBeInTheDocument()

    expect(within(gym!).getByText('Bloqueado')).toBeInTheDocument()
    expect(within(gym!).queryByText('Segredo do ginásio.')).not.toBeInTheDocument()
    expect(within(gym!).queryByText(/Roark/)).not.toBeInTheDocument()
  })

  it('starts a new player at the first step', async () => {
    renderPage()

    expect(await screen.findByText('0 de 3 etapas concluídas')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
  })

  it('shows the story completion percentage', async () => {
    listCampaignProgressMock.mockResolvedValue([
      {
        owner_id: 'owner-1',
        node_id: 'sinnoh.town',
        victories: 1,
        completed_at: '2026-10-13T00:00:00Z',
      },
    ])
    renderPage()

    expect(await screen.findByText('33%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Conclusão da história' })).toHaveAttribute(
      'aria-valuenow',
      '33',
    )
  })

  it('paginates a long journey and opens on the page where the player stopped', async () => {
    const nodes = Array.from({ length: 25 }, (_, index) =>
      node({
        id: 'sinnoh.step-' + (index + 1),
        sort_order: index + 1,
        title: 'Etapa ' + (index + 1),
      }),
    )
    getCampaignContentMock.mockResolvedValue({
      nodes,
      prerequisites: nodes.slice(1).map((entry, index) => ({
        node_id: entry.id,
        requires_node_id: nodes[index]!.id,
      })),
    })
    // 12 steps done -> the next encounter is step 13, on page 2.
    listCampaignProgressMock.mockResolvedValue(
      nodes.slice(0, 12).map((entry) => ({
        owner_id: 'owner-1',
        node_id: entry.id,
        victories: 3,
        completed_at: '2026-10-13T00:00:00Z',
      })),
    )
    renderPage()

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('Etapa 13').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.queryByText('Etapa 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ir para onde parei' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Ir para onde parei' }))
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByText('Etapa 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  it('does not show page controls when everything fits on one page', async () => {
    renderPage()

    await screen.findByText('0 de 3 etapas concluídas')
    expect(screen.queryByRole('navigation', { name: 'Páginas da jornada' })).not.toBeInTheDocument()
  })

  it('shows a friendly error when the campaign cannot be loaded', async () => {
    getCampaignContentMock.mockRejectedValue({ code: '42501', message: 'denied' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para fazer essa ação.',
    )
  })
})
