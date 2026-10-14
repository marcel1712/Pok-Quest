/** Completed and archived tasks only ever grow; the lists show the most recent ones. */
export const TASK_HISTORY_LIMIT = 200

/**
 * Completed and archived tasks are deleted this long after being completed/archived,
 * by the daily `purge_old_tasks` job in the database. Display only — the number that
 * actually applies is the function's default; keep the two in sync.
 */
export const TASK_RETENTION_DAYS = 90
