import type { TaskStatus } from '../types'

const FILTERS: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'archived', label: 'Arquivadas' },
]

export function TaskFilterTabs({
  value,
  onChange,
}: {
  value: TaskStatus
  onChange: (status: TaskStatus) => void
}) {
  return (
    <div role="tablist" aria-label="Filtrar tarefas" className="flex gap-2 text-sm">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          role="tab"
          aria-selected={value === filter.value}
          onClick={() => onChange(filter.value)}
          className={
            value === filter.value
              ? 'rounded-control bg-surface-raised px-3 py-1.5 font-semibold text-accent-soft'
              : 'rounded-control px-3 py-1.5 text-ink-muted hover:text-ink'
          }
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
