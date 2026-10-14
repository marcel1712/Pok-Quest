import type { Tables } from '@/shared/types/database'

export type CampaignNode = Tables<'campaign_nodes'>
export type CampaignNodePrerequisite = Tables<'campaign_node_prerequisites'>
export type CampaignNodeProgress = Tables<'campaign_node_progress'>
export type GameProgress = Tables<'game_progress'>
export type CampaignEncounter = Tables<'encounters'>
export type Badge = Tables<'badges'>

export type CampaignContent = {
  nodes: CampaignNode[]
  prerequisites: CampaignNodePrerequisite[]
}

export type JourneyNodeStatus = 'locked' | 'available' | 'completed'

export type JourneyNode = {
  node: CampaignNode
  status: JourneyNodeStatus
  victories: number
}
