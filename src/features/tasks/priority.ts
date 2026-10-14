import { scheduleTasks } from './scheduling'
import type { Task } from './types'

export type PriorityTasks = {
  /** The few tasks worth showing first, most pressing first. */
  tasks: Task[]
  todayCount: number
  /** Overdue or without a due date — the "Pendentes" group of the Tasks page. */
  pendingCount: number
  /** How many pressing tasks were left out of `tasks` by the limit. */
  hiddenCount: number
}

/**
 * Picks what the dashboard shows: due today first, then overdue (oldest first), then
 * tasks with no date; harder tasks first within a group. Future tasks are never
 * "priority" — they live on the Tasks page.
 */
export function pickPriorityTasks(
  tasks: Task[],
  todayIsoDate: string,
  limit: number,
): PriorityTasks {
  const schedule = scheduleTasks(tasks, todayIsoDate)
  const byDifficulty = (a: Task, b: Task) => b.difficulty - a.difficulty

  const overdue = schedule.overdueOrUnscheduled
    .filter((task) => task.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || byDifficulty(a, b))
  const unscheduled = schedule.overdueOrUnscheduled
    .filter((task) => !task.due_date)
    .sort(byDifficulty)

  const ordered = [...[...schedule.today].sort(byDifficulty), ...overdue, ...unscheduled]

  return {
    tasks: ordered.slice(0, limit),
    todayCount: schedule.today.length,
    pendingCount: schedule.overdueOrUnscheduled.length,
    hiddenCount: Math.max(0, ordered.length - limit),
  }
}
