import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useBattleForFocusSession } from '../hooks/use-battle'
import { BattleResultCard } from './BattleResultCard'
import { BattleSequence } from './BattleSequence'
import type { Battle, EncounterKind } from '../types'

/**
 * Looks up whatever battle is attached to the just-confirmed session and shows its
 * already-resolved result — never recomputes or re-credits anything (the DB trigger
 * resolved it atomically with the confirmation itself). Reopening this after a reload
 * reads the same saved row, so there's nothing to duplicate.
 */
export function BattleResultSection({
  focusSessionId,
  reduceMotion,
  onNoBattle,
  onDismiss,
  renderEpilogue,
}: {
  focusSessionId: string
  reduceMotion: boolean
  onNoBattle: () => void
  onDismiss: () => void
  /** Story content for the resolved battle, supplied by the caller (campaign layer). */
  renderEpilogue?: (battle: Battle) => ReactNode
}) {
  const { data: battle, isLoading } = useBattleForFocusSession(focusSessionId)

  useEffect(() => {
    if (!isLoading && !battle) onNoBattle()
  }, [isLoading, battle, onNoBattle])

  if (isLoading || !battle) return null

  return (
    <BattleSequence
      encounter={{
        kind: battle.encounter_kind as EncounterKind,
        difficulty: battle.encounter_difficulty,
      }}
      reduceMotion={reduceMotion}
    >
      <BattleResultCard battle={battle} onDismiss={onDismiss}>
        {renderEpilogue?.(battle)}
      </BattleResultCard>
    </BattleSequence>
  )
}
