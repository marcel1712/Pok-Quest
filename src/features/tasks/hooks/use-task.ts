import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getTaskById } from '../api/tasks-repository'

export function useTask(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ''),
    queryFn: () => getTaskById(id as string),
    enabled: Boolean(id),
  })
}
