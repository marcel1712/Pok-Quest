import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateTask } from '../api/tasks-repository'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'

vi.mock('../api/tasks-repository', () => ({
  updateTask: vi.fn(),
}))

const updateTaskMock = vi.mocked(updateTask)

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    owner_id: 'owner-1',
    title: 'Estudar React',
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

beforeEach(() => {
  updateTaskMock.mockReset()
  updateTaskMock.mockImplementation(
    (id, patch) =>
      Promise.resolve({ ...makeTask({ id }), ...patch }) as ReturnType<typeof updateTask>,
  )
})

describe('TaskItem', () => {
  it('completes a pending task when its checkbox is clicked', async () => {
    const task = makeTask()
    renderWithClient(<TaskItem task={task} />)

    await userEvent.click(screen.getByRole('button', { name: 'Concluir tarefa' }))

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalled())
    expect(updateTaskMock).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('reopens a completed task when its checkbox is clicked', async () => {
    const task = makeTask({ status: 'completed', completed_at: '2026-01-02T00:00:00Z' })
    renderWithClient(<TaskItem task={task} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reabrir tarefa' }))

    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith('task-1', {
        status: 'pending',
        completed_at: null,
      }),
    )
  })

  it('archives a task only after confirming', async () => {
    const task = makeTask()
    renderWithClient(<TaskItem task={task} />)

    await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(updateTaskMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Sim' }))

    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith('task-1', { status: 'archived' }),
    )
  })

  it('cancelling the archive confirmation does not archive the task', async () => {
    const task = makeTask()
    renderWithClient(<TaskItem task={task} />)

    await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeInTheDocument()
    expect(updateTaskMock).not.toHaveBeenCalled()
  })

  it('edits a task and submits only the changed fields', async () => {
    const task = makeTask()
    renderWithClient(<TaskItem task={task} />)

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const titleInput = screen.getByPlaceholderText('O que você precisa fazer?')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Estudar TypeScript')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ title: 'Estudar TypeScript' }),
      ),
    )
  })
})
