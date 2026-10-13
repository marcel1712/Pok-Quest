import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  getActiveSession,
  startSession,
  transitionSession,
} from '@/features/focus/api/focus-sessions-repository'
import { getTaskById, listTasks } from '@/features/tasks/api/tasks-repository'
import type { FocusSession } from '@/features/focus/types'
import { FocusPage } from './FocusPage'

vi.mock('@/features/focus/api/focus-sessions-repository', () => ({
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  transitionSession: vi.fn(),
}))

vi.mock('@/features/tasks/api/tasks-repository', () => ({
  listTasks: vi.fn(),
  getTaskById: vi.fn(),
}))

const getActiveSessionMock = vi.mocked(getActiveSession)
const startSessionMock = vi.mocked(startSession)
const transitionSessionMock = vi.mocked(transitionSession)
const listTasksMock = vi.mocked(listTasks)
const getTaskByIdMock = vi.mocked(getTaskById)

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 'session-1',
    owner_id: 'owner-1',
    task_id: null,
    planned_duration_seconds: 1500,
    status: 'running',
    started_at: new Date().toISOString(),
    paused_at: null,
    accumulated_pause_seconds: 0,
    ended_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FocusPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getActiveSessionMock.mockReset()
  startSessionMock.mockReset()
  transitionSessionMock.mockReset()
  listTasksMock.mockReset().mockResolvedValue([])
  getTaskByIdMock.mockReset()
  useAuthStore.setState({ status: 'authenticated', session: { user: { id: 'owner-1' } } as never })
})

describe('FocusPage — no active session', () => {
  it('shows the start form and starts a session with the chosen duration', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    startSessionMock.mockResolvedValue(makeSession())
    renderPage()

    await screen.findByRole('button', { name: 'Iniciar foco' })
    await userEvent.click(screen.getByRole('button', { name: '45 min' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar foco' }))

    await waitFor(() =>
      expect(startSessionMock).toHaveBeenCalledWith('owner-1', {
        plannedDurationSeconds: 2700,
        taskId: null,
      }),
    )
  })
})

describe('FocusPage — running session', () => {
  it('shows the countdown and pauses the session', async () => {
    const session = makeSession()
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    renderPage()

    expect(await screen.findByRole('timer')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running'],
        expect.objectContaining({ status: 'paused' }),
      ),
    )
  })

  it('shows the linked task title when the session has one', async () => {
    const session = makeSession({ task_id: 'task-1' })
    getActiveSessionMock.mockResolvedValue(session)
    getTaskByIdMock.mockResolvedValue({ id: 'task-1', title: 'Estudar React' } as never)
    renderPage()

    expect(await screen.findByText('Tarefa: Estudar React')).toBeInTheDocument()
  })

  it('cancels only after confirming', async () => {
    const session = makeSession()
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    await screen.findByRole('timer')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(transitionSessionMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running', 'paused'],
        expect.objectContaining({ status: 'cancelled' }),
      ),
    )
  })
})

describe('FocusPage — awaiting confirmation', () => {
  it('shows the confirm prompt once the planned duration has already elapsed', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValue(session)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    expect(
      await screen.findByText('O tempo planejado terminou. Confirma a conclusão?'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() =>
      expect(transitionSessionMock).toHaveBeenCalledWith(
        'session-1',
        ['running'],
        expect.objectContaining({ status: 'completed' }),
      ),
    )
  })
})
