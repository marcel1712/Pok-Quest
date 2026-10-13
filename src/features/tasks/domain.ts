import type { TaskStatus, TaskUpdate } from './types'

export class TaskTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskTransitionError'
  }
}

type StatusHolder = { status: string }

/**
 * Completing an already-completed task is a no-op (RF-009: duplicate clicks must not
 * duplicate rewards). Completing an archived task is not a valid transition.
 */
export function completeTask(task: StatusHolder): TaskUpdate {
  if (task.status === 'archived') {
    throw new TaskTransitionError('Uma tarefa arquivada não pode ser concluída.')
  }
  if (task.status === 'completed') {
    return {}
  }
  return { status: 'completed' satisfies TaskStatus, completed_at: new Date().toISOString() }
}

/** Only a completed task can be reopened; reopening clears `completed_at`. */
export function reopenTask(task: StatusHolder): TaskUpdate {
  if (task.status === 'pending') {
    return {}
  }
  if (task.status !== 'completed') {
    throw new TaskTransitionError('Só é possível reabrir uma tarefa concluída.')
  }
  return { status: 'pending' satisfies TaskStatus, completed_at: null }
}

/** Archiving is allowed from any status and is idempotent. */
export function archiveTask(task: StatusHolder): TaskUpdate {
  if (task.status === 'archived') {
    return {}
  }
  return { status: 'archived' satisfies TaskStatus }
}
