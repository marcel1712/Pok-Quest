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
}
