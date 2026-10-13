import type { CampaignContent, CampaignNodeProgress, JourneyNode } from './types'

/**
 * Derives each node's status from content + progress. This is only for *display*: the
 * same rule (every prerequisite completed) is enforced for real by the
 * `enforce_campaign_node_on_battle` trigger, which is what a battle insert must pass.
 */
export function buildJourney(
  content: CampaignContent,
  progress: CampaignNodeProgress[],
): JourneyNode[] {
  const progressByNode = new Map(progress.map((entry) => [entry.node_id, entry]))
  const isCompleted = (nodeId: string) => Boolean(progressByNode.get(nodeId)?.completed_at)

  return [...content.nodes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((node) => {
      const unlocked = content.prerequisites
        .filter((prerequisite) => prerequisite.node_id === node.id)
        .every((prerequisite) => isCompleted(prerequisite.requires_node_id))

      return {
        node,
        status: isCompleted(node.id) ? 'completed' : unlocked ? 'available' : 'locked',
        victories: progressByNode.get(node.id)?.victories ?? 0,
      }
    })
}

/**
 * The node the next encounter is fought on: the earliest node still in progress, or —
 * once the story has nothing left to offer — the latest repeatable route, so there is
 * always somewhere to keep exploring.
 */
export function pickObjective(journey: JourneyNode[]): JourneyNode | null {
  const inProgress = journey.find((entry) => entry.status === 'available')
  if (inProgress) return inProgress

  return journey.findLast((entry) => entry.status === 'completed' && entry.node.repeatable) ?? null
}
