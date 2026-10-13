import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import {
  listProductivityEvents,
  type ProductivityEventFilters,
} from '../api/productivity-events-repository'

export function useProductivityEvents(filters: ProductivityEventFilters = {}) {
  return useQuery({
    queryKey: queryKeys.productivityEvents.list(filters),
    queryFn: () => listProductivityEvents(filters),
  })
}
