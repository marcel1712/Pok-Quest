import { TaskForm } from '@/features/tasks/components/TaskForm'
import { TaskItem } from '@/features/tasks/components/TaskItem'
import { useCreateTask } from '@/features/tasks/hooks/use-task-mutations'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import { pickPriorityTasks } from '@/features/tasks/priority'
import { todayIsoDate } from '@/features/tasks/scheduling'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { WidgetCard } from './WidgetCard'

const VISIBLE_TASKS = 5

export function TasksWidget({ className }: { className?: string }) {
  // Same query (and cache entry) as the Tasks page's default "pending" tab, so opening
  // either after the other needs no new request, and completing a task here updates
  // both through the mutation's optimistic patch.
  const { data: tasks, isLoading, error, refetch } = useTasks({ status: 'pending' })
  const createTask = useCreateTask()
  const priority = pickPriorityTasks(tasks ?? [], todayIsoDate(), VISIBLE_TASKS)

  return (
    <WidgetCard
      className={className}
      title="Tarefas"
      linkTo="/tasks"
      linkLabel="Ver todas"
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
    >
      <p className="text-sm text-ink-muted">
        {priority.todayCount} para hoje · {priority.pendingCount}{' '}
        {priority.pendingCount === 1 ? 'pendente' : 'pendentes'}
      </p>

      {priority.tasks.length === 0 ? (
        <p className="text-ink-muted">Nada urgente. Adicione uma tarefa abaixo.</p>
      ) : (
        <ul aria-label="Tarefas prioritárias" className="flex flex-col gap-2">
          {priority.tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}

      {priority.hiddenCount > 0 && (
        <p className="text-xs text-ink-muted">+ {priority.hiddenCount} em Tarefas</p>
      )}

      <TaskForm
        submitLabel="Adicionar tarefa"
        pendingLabel="Adicionando…"
        isSubmitting={createTask.isPending}
        onSubmit={(input) => createTask.mutate(input)}
      />
      {createTask.isError && (
        <p role="alert" className="text-sm text-danger">
          {toFriendlyErrorMessage(createTask.error)}
        </p>
      )}
    </WidgetCard>
  )
}
