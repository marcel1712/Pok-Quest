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
              ? 'rounded bg-slate-800 px-3 py-1.5 font-semibold text-emerald-400'
              : 'rounded px-3 py-1.5 text-slate-400 hover:text-slate-200'
          }
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
