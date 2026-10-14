import { useState } from 'react'
import {
  useArchiveTask,
  useCompleteTask,
  useReopenTask,
  useUpdateTask,
} from '../hooks/use-task-mutations'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import type { Task } from '../types'
import { TaskForm } from './TaskForm'

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'muito fácil',
  2: 'fácil',
  3: 'média',
  4: 'difícil',
  5: 'muito difícil',
}

export function TaskItem({ task }: { task: Task }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false)

  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const archiveTask = useArchiveTask()
  const updateTask = useUpdateTask()

  const errorMessage =
    completeTask.error || reopenTask.error || archiveTask.error
      ? toFriendlyErrorMessage(completeTask.error ?? reopenTask.error ?? archiveTask.error)
      : null

  if (isEditing) {
    return (
      <li className="rounded-control border border-line bg-surface/50 p-3">
        <TaskForm
          initialValues={{
            title: task.title,
            description: task.description ?? '',
            difficulty: task.difficulty,
            dueDate: task.due_date ?? '',
          }}
          submitLabel="Salvar"
          pendingLabel="Salvando…"
          isSubmitting={updateTask.isPending}
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) => {
            updateTask.mutate(
              { id: task.id, patch: input },
              { onSuccess: () => setIsEditing(false) },
            )
          }}
        />
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 rounded-control border border-line p-3">
      <button
        type="button"
        onClick={() =>
          task.status === 'completed' ? reopenTask.mutate(task) : completeTask.mutate(task)
        }
        aria-pressed={task.status === 'completed'}
        aria-label={task.status === 'completed' ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className="mt-0.5 h-5 w-5 shrink-0 rounded-control border border-line-strong aria-pressed:border-accent aria-pressed:bg-accent"
      />

      <div className="flex-1">
        <p
          className={
            task.status === 'completed' ? 'text-ink-muted line-through' : 'font-medium text-ink'
          }
        >
          {task.title}
        </p>
        {task.description && <p className="mt-1 text-sm text-ink-muted">{task.description}</p>}
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted">
          <span>{DIFFICULTY_LABEL[task.difficulty] ?? task.difficulty}</span>
          {task.due_date && <span>{task.due_date}</span>}
        </div>
        {errorMessage && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 text-sm">
        {task.status !== 'archived' && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-ink-muted hover:text-ink"
          >
            Editar
          </button>
        )}

        {isConfirmingArchive ? (
          <span className="flex items-center gap-2">
            <span className="text-ink-muted">Arquivar?</span>
            <button
              type="button"
              onClick={() => {
                archiveTask.mutate(task)
                setIsConfirmingArchive(false)
              }}
              className="font-semibold text-danger hover:underline"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingArchive(false)}
              className="text-ink-muted hover:text-ink"
            >
              Cancelar
            </button>
          </span>
        ) : (
          task.status !== 'archived' && (
            <button
              type="button"
              onClick={() => setIsConfirmingArchive(true)}
              className="text-ink-muted hover:text-ink"
            >
              Arquivar
            </button>
          )
        )}
      </div>
    </li>
  )
}
