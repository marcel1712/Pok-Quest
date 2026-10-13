import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  getActiveSession,
  listCompletedSessions,
  startSession,
  transitionSession,
} from '@/features/focus/api/focus-sessions-repository'
import { getProfile, updateFocusPreferences } from '@/features/settings/api/profile-repository'
import { getTaskById, listTasks } from '@/features/tasks/api/tasks-repository'
import type { FocusSession } from '@/features/focus/types'
import { FocusPage } from './FocusPage'

vi.mock('@/features/focus/api/focus-sessions-repository', () => ({
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  transitionSession: vi.fn(),
  listCompletedSessions: vi.fn(),
}))

vi.mock('@/features/settings/api/profile-repository', () => ({
  getProfile: vi.fn(),
  updateFocusPreferences: vi.fn(),
}))

vi.mock('@/features/tasks/api/tasks-repository', () => ({
  listTasks: vi.fn(),
  getTaskById: vi.fn(),
}))

const getActiveSessionMock = vi.mocked(getActiveSession)
const startSessionMock = vi.mocked(startSession)
const transitionSessionMock = vi.mocked(transitionSession)
const listCompletedSessionsMock = vi.mocked(listCompletedSessions)
const getProfileMock = vi.mocked(getProfile)
const updateFocusPreferencesMock = vi.mocked(updateFocusPreferences)
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

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'owner-1',
    timezone: 'UTC',
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  getActiveSessionMock.mockReset()
  startSessionMock.mockReset()
  transitionSessionMock.mockReset()
  listCompletedSessionsMock.mockReset().mockResolvedValue([])
  getProfileMock.mockReset().mockResolvedValue(makeProfile() as never)
  updateFocusPreferencesMock.mockReset()
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

  it('offers an optional rest break after confirming, which can be started or skipped', async () => {
    const session = makeSession({
      started_at: new Date(Date.now() - 2_000_000).toISOString(),
      planned_duration_seconds: 60,
    })
    getActiveSessionMock.mockResolvedValueOnce(session).mockResolvedValue(null)
    transitionSessionMock.mockResolvedValue({
      ...session,
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar conclusão' }))

    expect(
      await screen.findByText('Sessão concluída! Quer descansar um pouco antes da próxima?'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Descanso curto (5 min)' }))
    expect(await screen.findByRole('timer')).toHaveTextContent('05:00')

    await userEvent.click(screen.getByRole('button', { name: 'Pular descanso' }))
    expect(await screen.findByRole('button', { name: 'Iniciar foco' })).toBeInTheDocument()
  })
})

describe('FocusPage — preferences', () => {
  it('uses the stored presets instead of hardcoded ones', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    getProfileMock.mockResolvedValue(
      makeProfile({ settings: { focus: { presetsMinutes: [10, 20] } } }) as never,
    )
    renderPage()

    await screen.findByRole('button', { name: '10 min' })
    expect(screen.getByRole('button', { name: '20 min' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '25 min' })).not.toBeInTheDocument()
  })

  it('persists the sound preference when the checkbox is toggled', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    renderPage()

    await screen.findByRole('button', { name: 'Iniciar foco' })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Som ao terminar' }))

    await waitFor(() =>
      expect(updateFocusPreferencesMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ soundEnabled: true }),
      ),
    )
  })
})

describe('FocusPage — history', () => {
  it('shows today and 7-day totals from completed sessions only', async () => {
    getActiveSessionMock.mockResolvedValue(null)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    listCompletedSessionsMock.mockResolvedValue([
      makeSession({ status: 'completed', ended_at: twoDaysAgo, planned_duration_seconds: 1500 }),
    ] as never)
    renderPage()

    expect(await screen.findByText('0 sessões · 0 min')).toBeInTheDocument()
    expect(screen.getByText('1 sessão · 25 min')).toBeInTheDocument()
  })
})
