import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { listTasks, type TaskListFilters } from '../api/tasks-repository'

export function useTasks(filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => listTasks(filters),
  })
}
