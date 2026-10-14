import { useState } from 'react'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import { useFocusPreferences } from '@/features/settings/hooks/use-focus-preferences'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { useStartFocusSession } from '../hooks/use-focus-session-mutations'

export function StartSessionForm() {
  const { preferences } = useFocusPreferences()
  const [minutes, setMinutes] = useState(25)
  const [taskId, setTaskId] = useState<string>('')
  const { data: tasks } = useTasks({ status: 'pending' })
  const startSession = useStartFocusSession()

  function handleStart() {
    startSession.mutate({
      plannedDurationSeconds: minutes * 60,
      taskId: taskId || null,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm text-ink-muted">Duração</p>
        <div className="flex flex-wrap gap-2">
          {preferences.presetsMinutes.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={minutes === preset}
              onClick={() => setMinutes(preset)}
              className="rounded-control px-3 py-1.5 text-sm text-ink-muted hover:text-ink aria-pressed:bg-surface-raised aria-pressed:font-semibold aria-pressed:text-accent-soft"
            >
              {preset} min
            </button>
          ))}
          <label className="flex items-center gap-1 text-sm text-ink-muted">
            personalizado:
            <input
              type="number"
              min={1}
              max={120}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="input w-16 px-2 py-1"
            />
            min
          </label>
        </div>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="focus-task" className="text-sm text-ink-muted">
            Vincular a uma tarefa (opcional)
          </label>
          <select
            id="focus-task"
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            className="input text-sm"
          >
            <option value="">Nenhuma</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={startSession.isPending || minutes < 1}
        className="btn btn-primary btn-lg self-start"
      >
        {startSession.isPending ? 'Iniciando…' : 'Iniciar foco'}
      </button>

      {startSession.isError && (
        <p role="alert" className="text-sm text-danger">
          {toFriendlyErrorMessage(startSession.error)}
        </p>
      )}
    </div>
  )
}
