import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTask, listTasks } from '@/features/tasks/api/tasks-repository'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type { Task } from '@/features/tasks/types'
import { TasksPage } from './TasksPage'

vi.mock('@/features/tasks/api/tasks-repository', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}))

const listTasksMock = vi.mocked(listTasks)
const createTaskMock = vi.mocked(createTask)

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    owner_id: 'owner-1',
    title: 'Tarefa existente',
    description: null,
    category_id: null,
    difficulty: 2,
    due_date: null,
    status: 'pending',
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TasksPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  listTasksMock.mockReset()
  createTaskMock.mockReset()
  useAuthStore.setState({
    status: 'authenticated',
    session: { user: { id: 'owner-1' } } as never,
  })
})

describe('TasksPage', () => {
  it('shows an empty state when there are no pending tasks', async () => {
    listTasksMock.mockResolvedValue([])
    renderPage()

    expect(
      await screen.findByText('Nenhuma tarefa pendente. Adicione uma acima.'),
    ).toBeInTheDocument()
  })

  it('groups pending tasks into Hoje / Pendentes / Futuras', async () => {
    listTasksMock.mockResolvedValue([
      makeTask({ id: '1', title: 'Sem data', due_date: null }),
      makeTask({ id: '2', title: 'Futura', due_date: '2099-01-01' }),
    ])
    renderPage()

    expect(await screen.findByText('Futura')).toBeInTheDocument()
    expect(screen.getByText('Sem data')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Futuras' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pendentes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hoje' })).not.toBeInTheDocument()
  })

  it('creates a task through the form and refetches the list', async () => {
    listTasksMock.mockResolvedValue([])
    createTaskMock.mockResolvedValue(makeTask({ id: 'new-task', title: 'Nova tarefa' }))
    renderPage()

    await screen.findByText('Nenhuma tarefa pendente. Adicione uma acima.')

    await userEvent.type(screen.getByPlaceholderText('O que você precisa fazer?'), 'Nova tarefa')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))

    await waitFor(() =>
      expect(createTaskMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ title: 'Nova tarefa' }),
      ),
    )
  })

  it('switches to the Concluídas filter and lists completed tasks flat', async () => {
    listTasksMock.mockResolvedValue([])
    renderPage()
    await screen.findByText('Nenhuma tarefa pendente. Adicione uma acima.')

    listTasksMock.mockResolvedValue([makeTask({ id: '1', title: 'Feito', status: 'completed' })])
    await userEvent.click(screen.getByRole('tab', { name: 'Concluídas' }))

    expect(await screen.findByText('Feito')).toBeInTheDocument()
    expect(listTasksMock).toHaveBeenCalledWith({ status: 'completed' })
  })
})
