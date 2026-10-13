import type { Task } from './types'

export type TaskSchedule = {
  today: Task[]
  overdueOrUnscheduled: Task[]
  upcoming: Task[]
}

/**
 * Splits pending tasks into "Hoje" / "Pendentes" (overdue or with no due date — the
 * ones that need attention) / "Futuras", comparing `due_date` (a plain DATE column)
 * against the caller's local-date string. Timezone preference (RNF-013) isn't wired
 * in yet — see docs/DECISIONS.md.
 */
export function scheduleTasks(tasks: Task[], todayIsoDate: string): TaskSchedule {
  const schedule: TaskSchedule = { today: [], overdueOrUnscheduled: [], upcoming: [] }

  for (const task of tasks) {
    if (task.status !== 'pending') continue

    if (!task.due_date) {
      schedule.overdueOrUnscheduled.push(task)
    } else if (task.due_date === todayIsoDate) {
      schedule.today.push(task)
    } else if (task.due_date < todayIsoDate) {
      schedule.overdueOrUnscheduled.push(task)
    } else {
      schedule.upcoming.push(task)
    }
  }

  return schedule
}

export function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
