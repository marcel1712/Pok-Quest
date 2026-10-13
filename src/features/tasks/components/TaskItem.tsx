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
      <li className="rounded border border-slate-800 bg-slate-900/50 p-3">
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
    <li className="flex items-start gap-3 rounded border border-slate-800 p-3">
      <button
        type="button"
        onClick={() =>
          task.status === 'completed' ? reopenTask.mutate(task) : completeTask.mutate(task)
        }
        aria-pressed={task.status === 'completed'}
        aria-label={task.status === 'completed' ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border border-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 aria-pressed:border-emerald-500 aria-pressed:bg-emerald-500"
      />

      <div className="flex-1">
        <p
          className={
            task.status === 'completed'
              ? 'text-slate-500 line-through'
              : 'font-medium text-slate-100'
          }
        >
          {task.title}
        </p>
        {task.description && <p className="mt-1 text-sm text-slate-400">{task.description}</p>}
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{DIFFICULTY_LABEL[task.difficulty] ?? task.difficulty}</span>
          {task.due_date && <span>{task.due_date}</span>}
        </div>
        {errorMessage && (
          <p role="alert" className="mt-1 text-sm text-red-400">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 text-sm">
        {task.status !== 'archived' && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-slate-400 hover:text-slate-200"
          >
            Editar
          </button>
        )}

        {isConfirmingArchive ? (
          <span className="flex items-center gap-2">
            <span className="text-slate-400">Arquivar?</span>
            <button
              type="button"
              onClick={() => {
                archiveTask.mutate(task)
                setIsConfirmingArchive(false)
              }}
              className="font-semibold text-red-400 hover:text-red-300"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingArchive(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </span>
        ) : (
          task.status !== 'archived' && (
            <button
              type="button"
              onClick={() => setIsConfirmingArchive(true)}
              className="text-slate-400 hover:text-slate-200"
            >
              Arquivar
            </button>
          )
        )}
      </div>
    </li>
  )
}
