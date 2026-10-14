import type { Badge, JourneyNode } from '../types'

/** Every badge the campaign offers, in story order, earned or not. */
export function BadgeCase({ journey, badges }: { journey: JourneyNode[]; badges: Badge[] }) {
  const badgeNodes = journey.filter((entry) => entry.node.badge_name)
  if (badgeNodes.length === 0) return null

  const earnedNodeIds = new Set(badges.map((badge) => badge.node_id))
  const earnedCount = badgeNodes.filter((entry) => earnedNodeIds.has(entry.node.id)).length

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-slate-100">
        Insígnias · {earnedCount}/{badgeNodes.length}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {badgeNodes.map(({ node }) => {
          const earned = earnedNodeIds.has(node.id)
          return (
            <li
              key={node.id}
              className={`flex items-center gap-2 rounded border p-2 text-sm ${
                earned
                  ? 'border-amber-400/60 text-slate-100'
                  : 'border-slate-800 text-slate-500 opacity-70'
              }`}
            >
              <span aria-hidden="true">{earned ? '🏅' : '⚪'}</span>
              <span>
                {node.badge_name}
                <span className="sr-only">
                  {earned ? ' — conquistada' : ' — ainda não conquistada'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
