import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRewardEvents } from '@/features/rewards/api/reward-events-repository'
import type { Battle } from '../types'
import { BattleResultCard } from './BattleResultCard'

vi.mock('@/features/rewards/api/reward-events-repository', () => ({
  listRewardEvents: vi.fn(),
}))

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
