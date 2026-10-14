import { motion } from 'motion/react'
import type { Battle } from '@/features/battles/types'
import { useBadges } from '../hooks/use-badges'
import { useJourney } from '../hooks/use-journey'

/**
 * What a won battle meant for the story: the badge it earned (if the database credited
 * one to this very battle) and the node's closing scene once the node is completed.
 * Purely a reading of saved state — reopening the result shows the same thing.
 */
export function VictoryEpilogue({ battle }: { battle: Battle }) {
  const { journey } = useJourney()
  const { data: badges } = useBadges()

  if (battle.result !== 'victory' || !battle.campaign_node_id) return null

  const entry = journey.find((candidate) => candidate.node.id === battle.campaign_node_id)
  if (!entry) return null

  const earnedBadge = badges?.some((badge) => badge.battle_id === battle.id)
  const outro = entry.status === 'completed' ? entry.node.scene_outro : []
  if (!earnedBadge && outro.length === 0) return null

  return (
    <div className="flex max-w-sm flex-col gap-2 rounded-control border border-line bg-surface/50 p-3">
      {earnedBadge && entry.node.badge_name && (
        // The one celebratory moment worth animating: a rare, earned reward. MotionConfig
        // in RootLayout drops the movement under reduced-motion settings.
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="font-semibold text-warning"
        >
          <span aria-hidden="true">🏅 </span>
          Você conquistou a {entry.node.badge_name}!
        </motion.p>
      )}
      {outro.map((line) => (
        <p key={line} className="text-sm text-ink-soft">
          {line}
        </p>
      ))}
    </div>
  )
}
