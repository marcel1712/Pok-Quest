/**
 * Query key factories, one per domain. Convention: [domain, operation, ...params].
 * Mutations invalidate by domain prefix (e.g. `queryKeys.tasks.all`), never the whole cache.
 * Add a new domain here as its feature introduces real queries — keep it in sync with
 * `docs/DECISIONS.md`.
 */
export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    list: (filters: Record<string, unknown> = {}) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
  productivityEvents: {
    all: ['productivityEvents'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['productivityEvents', 'list', filters] as const,
  },
  focusSessions: {
    all: ['focusSessions'] as const,
    active: () => ['focusSessions', 'active'] as const,
    completedHistory: () => ['focusSessions', 'completedHistory'] as const,
  },
  profile: {
    all: ['profile'] as const,
    detail: (id: string) => ['profile', 'detail', id] as const,
  },
  battles: {
    all: ['battles'] as const,
    detail: (id: string) => ['battles', 'detail', id] as const,
    forTask: (taskId: string) => ['battles', 'forTask', taskId] as const,
    forFocusSession: (focusSessionId: string) =>
      ['battles', 'forFocusSession', focusSessionId] as const,
  },
  rewardEvents: {
    all: ['rewardEvents'] as const,
    list: (filters: Record<string, unknown> = {}) => ['rewardEvents', 'list', filters] as const,
  },
}
