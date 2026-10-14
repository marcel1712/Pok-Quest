import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistorySummary, listHistoryEntries } from '@/features/history/api/history-repository'
import type { HistoryEntry, HistorySummary, HistoryTotals } from '@/features/history/types'
import {
  getCampaignContent,
  listBadges,
  listCampaignProgress,
} from '@/features/journey/api/campaign-repository'
import { listOwnedPokemon } from '@/features/pokemon/api/owned-pokemon-repository'
import { getProfile } from '@/features/settings/api/profile-repository'
import { HistoryPage } from './HistoryPage'

vi.mock('@/features/history/api/history-repository', () => ({
  listHistoryEntries: vi.fn(),
  getHistorySummary: vi.fn(),
  HISTORY_FETCH_LIMIT: 1000,
}))
vi.mock('@/features/journey/api/campaign-repository', () => ({
  getCampaignContent: vi.fn(),
  listCampaignProgress: vi.fn(),
  listBadges: vi.fn(),
  getCurrentEncounter: vi.fn(),
}))
vi.mock('@/features/pokemon/api/owned-pokemon-repository', () => ({
  listOwnedPokemon: vi.fn(),
}))
vi.mock('@/features/settings/api/profile-repository', () => ({
  getProfile: vi.fn(),
  updateFocusPreferences: vi.fn(),
}))

const listHistoryEntriesMock = vi.mocked(listHistoryEntries)
const getHistorySummaryMock = vi.mocked(getHistorySummary)
const getCampaignContentMock = vi.mocked(getCampaignContent)
const listCampaignProgressMock = vi.mocked(listCampaignProgress)
const listBadgesMock = vi.mocked(listBadges)
const listOwnedPokemonMock = vi.mocked(listOwnedPokemon)
const getProfileMock = vi.mocked(getProfile)

const HOUR = 60 * 60 * 1000
const now = Date.now()
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

function totals(overrides: Partial<HistoryTotals> = {}): HistoryTotals {
  return {
    tasksCompleted: 0,
    focusSessions: 0,
    focusMinutes: 0,
    victories: 0,
    xpEarned: 0,
    captures: 0,
    ...overrides,
  }
}

const summary: HistorySummary = {
  today: totals({ tasksCompleted: 1, focusMinutes: 25, focusSessions: 1 }),
  last7Days: totals({ tasksCompleted: 4, focusMinutes: 95, focusSessions: 3, victories: 2 }),
  last30Days: totals({ tasksCompleted: 9, focusMinutes: 300, focusSessions: 8, victories: 5 }),
  allTime: totals({
    tasksCompleted: 40,
    focusMinutes: 1500,
    focusSessions: 50,
    victories: 30,
    xpEarned: 2000,
    captures: 6,
  }),
}

const entries: HistoryEntry[] = [
  {
    id: 'task:1',
    kind: 'task',
    occurredAt: iso(1 * HOUR),
    title: 'Entregar relatório',
    detail: null,
    amount: 3,
  },
  {
    id: 'battle:1',
    kind: 'battle',
    occurredAt: iso(2 * HOUR),
    title: 'Starly',
    detail: 'wild · Rota 201',
    amount: 45,
  },
  {
    id: 'focus:1',
    kind: 'focus',
    occurredAt: iso(10 * 24 * HOUR),
    title: 'Sessão de foco',
    detail: null,
    amount: 25,
  },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listHistoryEntriesMock.mockReset().mockResolvedValue(entries)
  getHistorySummaryMock.mockReset().mockResolvedValue(summary)
  getCampaignContentMock.mockReset().mockResolvedValue({ nodes: [], prerequisites: [] })
  listCampaignProgressMock.mockReset().mockResolvedValue([])
  listBadgesMock.mockReset().mockResolvedValue([])
  listOwnedPokemonMock.mockReset().mockResolvedValue([])
  // A timezone where "one hour ago" and "two hours ago" are on the same day as now is
  // not guaranteed; the assertions below only rely on the 10-days-ago entry being apart.
  getProfileMock.mockReset().mockResolvedValue({
    id: 'owner-1',
    timezone: 'UTC',
    settings: {},
    created_at: iso(0),
    updated_at: iso(0),
  } as never)
})

describe('HistoryPage', () => {
  it('shows the totals for each period', async () => {
    renderPage()

    const table = await screen.findByRole('table', { name: 'Resumo de atividade por período' })
    const focused = within(table).getByRole('row', { name: /Tempo focado/ })
    expect(
      within(focused)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['25 min', '1h35', '5h', '25h'])
    const xp = within(table).getByRole('row', { name: /XP ganho/ })
    expect(within(xp).getAllByRole('cell').at(-1)).toHaveTextContent('2000')
  })

  it('lists what happened, described in words, grouped by day', async () => {
    renderPage()

    expect(await screen.findByText('Concluiu: Entregar relatório')).toBeInTheDocument()
    expect(screen.getByText('dificuldade 3/5')).toBeInTheDocument()
    expect(screen.getByText('Venceu Starly')).toBeInTheDocument()
    expect(screen.getByText('Pokémon selvagem · Rota 201 · +45 XP')).toBeInTheDocument()
    expect(screen.getByText('Sessão de foco concluída')).toBeInTheDocument()

    // The 10-days-ago session sits under its own day heading, after the recent ones.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.length).toBeGreaterThanOrEqual(2)
    const sessionDay = screen.getByText('Sessão de foco concluída').closest('section')
    expect(within(sessionDay!).queryByText('Venceu Starly')).not.toBeInTheDocument()
  })

  it('filters by kind without asking the server again', async () => {
    renderPage()
    await screen.findByText('Venceu Starly')
    const requestsBefore = listHistoryEntriesMock.mock.calls.length

    const filters = screen.getByRole('group', { name: 'Filtrar histórico' })
    // Only kinds that actually occur are offered.
    expect(
      within(filters)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Tudo', 'Tarefas', 'Foco', 'Batalhas'])

    await userEvent.click(within(filters).getByRole('button', { name: 'Batalhas' }))
    expect(screen.getByText('Venceu Starly')).toBeInTheDocument()
    expect(screen.queryByText('Concluiu: Entregar relatório')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão de foco concluída')).not.toBeInTheDocument()

    await userEvent.click(within(filters).getByRole('button', { name: 'Tudo' }))
    expect(screen.getByText('Concluiu: Entregar relatório')).toBeInTheDocument()

    expect(listHistoryEntriesMock.mock.calls.length).toBe(requestsBefore)
  })

  it('loads an older window on demand, keeping what is already shown', async () => {
    renderPage()
    await screen.findByText('Venceu Starly')
    expect(screen.getByText('Mostrando os últimos 30 dias.')).toBeInTheDocument()
    const firstSince = new Date(listHistoryEntriesMock.mock.calls[0]![0]).getTime()

    await userEvent.click(screen.getByRole('button', { name: 'Ver mais 30 dias' }))

    await waitFor(() =>
      expect(screen.getByText('Mostrando os últimos 60 dias.')).toBeInTheDocument(),
    )
    const lastSince = new Date(listHistoryEntriesMock.mock.calls.at(-1)![0]).getTime()
    expect(Math.round((firstSince - lastSince) / (24 * HOUR))).toBe(30)
    expect(screen.getByText('Venceu Starly')).toBeInTheDocument()
  })

  it('says so plainly when nothing happened, without any streak or blame', async () => {
    listHistoryEntriesMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Nada registrado nos últimos 30 dias.')).toBeInTheDocument()
    expect(screen.queryByText(/sequência perdida|dias seguidos|streak/i)).not.toBeInTheDocument()
  })

  it('shows a friendly error when the history cannot be loaded', async () => {
    listHistoryEntriesMock.mockRejectedValue({ code: '42501', message: 'denied' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para fazer essa ação.',
    )
    // The summary is independent and still shows.
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('tells the user that old tasks are deleted but stay in the history', async () => {
    renderPage()
    expect(
      await screen.findByText(/são apagadas da lista de Tarefas depois de 90 dias/),
    ).toBeInTheDocument()
  })
})
