import { supabase } from '@/shared/lib/supabase-client'
import type { RewardEvent } from '../types'

export type RewardEventFilters = {
  sourceType?: RewardEvent['source_type']
  sourceId?: string
}

/**
 * Read-only, same pattern as productivity-events-repository.ts: nothing writes to
 * `reward_events` directly — rows come only from `resolve_pending_battle` (T-022),
 * a SECURITY DEFINER function with EXECUTE revoked from anon/authenticated.
 */
export async function listRewardEvents(filters: RewardEventFilters = {}): Promise<RewardEvent[]> {
  let query = supabase.from('reward_events').select('*').order('created_at', { ascending: false })

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
