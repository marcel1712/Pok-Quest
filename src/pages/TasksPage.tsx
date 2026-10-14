import { useState } from 'react'
import { TaskFilterTabs } from '@/features/tasks/components/TaskFilterTabs'
import { TaskForm } from '@/features/tasks/components/TaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { useCreateTask } from '@/features/tasks/hooks/use-task-mutations'
import { TASK_HISTORY_LIMIT } from '@/features/tasks/limits'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import { scheduleTasks, todayIsoDate } from '@/features/tasks/scheduling'
import type { Task, TaskStatus } from '@/features/tasks/types'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'

function TaskGroup({ title, tasks }: { title: string; tasks: Task[] }) {
  if (tasks.length === 0) return null
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink-muted">{title}</h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
    </div>
  )
}

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('pending')
  const { data: tasks, isLoading, isError, error } = useTasks({ status: statusFilter })
  const createTask = useCreateTask()

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">Tarefas</h1>

      <div className="card">
        <TaskForm
          submitLabel="Adicionar tarefa"
          pendingLabel="Adicionando…"
          isSubmitting={createTask.isPending}
          onSubmit={(input) => createTask.mutate(input)}
        />
        {createTask.isError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {toFriendlyErrorMessage(createTask.error)}
          </p>
        )}
      </div>

      <TaskFilterTabs value={statusFilter} onChange={setStatusFilter} />

      {isLoading && <p className="text-ink-muted">Carregando tarefas…</p>}

      {isError && (
        <p role="alert" className="text-danger">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      {tasks && tasks.length === 0 && (
        <p className="text-ink-muted">
          {statusFilter === 'pending'
            ? 'Nenhuma tarefa pendente. Adicione uma acima.'
            : 'Nada por aqui ainda.'}
        </p>
      )}

      {tasks && tasks.length > 0 && statusFilter === 'pending' && (
        <div className="flex flex-col gap-6">
          {(() => {
            const schedule = scheduleTasks(tasks, todayIsoDate())
            return (
              <>
                <TaskGroup title="Hoje" tasks={schedule.today} />
                <TaskGroup title="Pendentes" tasks={schedule.overdueOrUnscheduled} />
                <TaskGroup title="Futuras" tasks={schedule.upcoming} />
              </>
            )
          })()}
        </div>
      )}

      {tasks && tasks.length > 0 && statusFilter !== 'pending' && (
        <>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
          {tasks.length >= TASK_HISTORY_LIMIT && (
            <p className="text-sm text-ink-muted">
              Mostrando as {TASK_HISTORY_LIMIT} mais recentes.
            </p>
          )}
        </>
      )}
    </section>
  )
}
