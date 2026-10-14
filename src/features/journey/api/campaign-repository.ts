import { supabase } from '@/shared/lib/supabase-client'
import type { CampaignContent, CampaignEncounter, CampaignNodeProgress } from '../types'

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

/**
 * The player's current encounter, generated and stored by the database the first time
 * it is asked for and returned unchanged until a battle against it is won — calling
 * this again (a refresh, another device) never rerolls it. `null` when there is no
 * campaign content to play.
 */
export async function getCurrentEncounter(): Promise<CampaignEncounter | null> {
  const { data, error } = await supabase.rpc('get_or_create_encounter')
  if (error) throw error
  // A SQL function returning a null composite arrives as a row of nulls.
  return data?.id ? data : null
}
