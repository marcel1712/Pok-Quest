import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCampaignContent,
  listBadges,
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
  listBadges: vi.fn(),
}))

const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)
const listBadgesMock = vi.mocked(listBadges)

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
    badge_name: null,
    scene_intro: [],
    scene_outro: [],
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
      badge_name: 'Insígnia do Carvão',
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

function steps() {
  return within(screen.getByRole('list', { name: 'Etapas da jornada' })).getAllByRole('listitem')
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
  listBadgesMock.mockReset().mockResolvedValue([])
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
    const [town, route, gym] = steps()

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
    expect(steps()[0]).toHaveAttribute('aria-current', 'step')
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
    expect(steps()).toHaveLength(10)
    expect(screen.getByText('Etapa 13').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.queryByText('Etapa 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ir para onde parei' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument()
    expect(steps()).toHaveLength(5)
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

  it('lists the badges, marking the earned ones', async () => {
    listBadgesMock.mockResolvedValue([
      {
        owner_id: 'owner-1',
        node_id: 'sinnoh.gym',
        battle_id: 'battle-1',
        earned_at: '2026-10-13T00:00:00Z',
      },
    ])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Insígnias · 1/1' })).toBeInTheDocument()
    expect(screen.getByText('— conquistada', { exact: false })).toBeInTheDocument()
  })

  it('shows unearned badges as not yet conquered', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Insígnias · 0/1' })).toBeInTheDocument()
    expect(screen.getByText('— ainda não conquistada', { exact: false })).toBeInTheDocument()
  })

  it('lets an unlocked scene be read again, but not a locked one', async () => {
    getCampaignContentMock.mockResolvedValue({
      ...content,
      nodes: content.nodes.map((entry) => ({
        ...entry,
        scene_intro: ['Cena de ' + entry.title],
        scene_outro: ['Desfecho de ' + entry.title],
      })),
    })
    listCampaignProgressMock.mockResolvedValue([
      {
        owner_id: 'owner-1',
        node_id: 'sinnoh.town',
        victories: 1,
        completed_at: '2026-10-13T00:00:00Z',
      },
    ])
    renderPage()

    await screen.findByText('1 de 3 etapas concluídas')
    const [town, route, gym] = steps()

    // Completed: intro and outro. In progress: intro only. Locked: nothing.
    expect(within(town!).getByText('Rever cena')).toBeInTheDocument()
    expect(within(town!).getByText('Desfecho de Twinleaf Town')).toBeInTheDocument()
    expect(within(route!).getByText('Cena de Rota 201')).toBeInTheDocument()
    expect(within(route!).queryByText('Desfecho de Rota 201')).not.toBeInTheDocument()
    expect(within(gym!).queryByText('Rever cena')).not.toBeInTheDocument()
  })

  it('shows a friendly error when the campaign cannot be loaded', async () => {
    getCampaignContentMock.mockRejectedValue({ code: '42501', message: 'denied' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para fazer essa ação.',
    )
  })
})
