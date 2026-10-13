import { supabase } from '@/shared/lib/supabase-client'
import type { ProductivityEvent } from '../types'

export type ProductivityEventFilters = {
  sourceType?: ProductivityEvent['source_type']
  sourceId?: string
}

/**
 * Read-only: nothing in the app writes to `productivity_events` directly — rows are
 * created exclusively by the `record_task_completion_event` DB trigger (see
 * supabase/migrations). This is here so a future reward engine (T-021+) has a stable
 * place to read the ledger from.
 */
export async function listProductivityEvents(
  filters: ProductivityEventFilters = {},
): Promise<ProductivityEvent[]> {
  let query = supabase
    .from('productivity_events')
    .select('*')
    .order('occurred_at', { ascending: false })

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType)
  }
  if (filters.sourceId) {
    query = query.eq('source_id', filters.sourceId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
