import { supabase } from '@/shared/lib/supabase-client'
import type { CampaignContent, CampaignNodeProgress } from '../types'

/** Reference content, seeded only by migrations generated from `content/`. */
export async function getCampaignContent(): Promise<CampaignContent> {
  const [nodes, prerequisites] = await Promise.all([
    supabase.from('campaign_nodes').select('*').order('sort_order', { ascending: true }),
    supabase.from('campaign_node_prerequisites').select('*'),
  ])

  if (nodes.error) throw nodes.error
  if (prerequisites.error) throw prerequisites.error
  return { nodes: nodes.data, prerequisites: prerequisites.data }
}

/** Read-only for the client: rows are written solely by the battle-resolution trigger. */
export async function listCampaignProgress(): Promise<CampaignNodeProgress[]> {
  const { data, error } = await supabase.from('campaign_node_progress').select('*')
  if (error) throw error
  return data
}
