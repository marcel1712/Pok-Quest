import { useEffect, useState, type ReactNode } from 'react'
import { ENCOUNTER_LABELS } from '../labels'
import type { Encounter } from '../types'

/**
 * Short, skippable reveal before showing the already-saved result — this never runs
 * during an active focus session (T-023: "não rodar animação... durante foco"), only
 * after confirmation, when the battle is already resolved server-side.
 */
export function BattleSequence({
  encounter,
  reduceMotion,
  children,
}: {
  encounter: Encounter
  reduceMotion: boolean
  children: ReactNode
}) {
  const [revealed, setRevealed] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion) return
    const timeout = setTimeout(() => setRevealed(true), 1200)
    return () => clearTimeout(timeout)
  }, [reduceMotion])

  if (revealed) return <>{children}</>

  const { label, glyph } = ENCOUNTER_LABELS[encounter.kind]

  return (
    <div className="card flex flex-col items-center gap-3 p-6">
      <span className="text-5xl motion-safe:animate-pulse" aria-hidden="true">
        {glyph}
      </span>
      <p className="text-ink-soft">Resolvendo encontro com {label}…</p>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="text-sm text-ink-muted hover:text-ink"
      >
        Pular animação
      </button>
    </div>
  )
}
