import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../format'

/**
 * Purely local, unpersisted countdown — the rest break is explicitly optional
 * (T-020: "sem transformar pausa em obrigação"), so it isn't a `focus_sessions` row or
 * a productivity event. Closing the tab mid-break loses nothing that matters.
 */
export function RestBreakTimer({
  minutes,
  onDone,
  onSkip,
}: {
  minutes: number
  onDone: () => void
  onSkip: () => void
}) {
  const totalSeconds = minutes * 60
  const [remaining, setRemaining] = useState(totalSeconds)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    startedAtRef.current = Date.now()

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)
      setRemaining(Math.max(0, totalSeconds - elapsed))
    }, 1000)

    return () => clearInterval(interval)
  }, [totalSeconds])

  useEffect(() => {
    if (remaining === 0) onDone()
  }, [remaining, onDone])

  return (
    <div className="card flex flex-col items-center gap-3">
      <p className="text-ink-soft">Descanso</p>
      <p className="text-4xl font-bold text-ink tabular-nums" role="timer">
        {formatDuration(remaining)}
      </p>
      <button type="button" onClick={onSkip} className="text-sm text-ink-muted hover:text-ink">
        Pular descanso
      </button>
    </div>
  )
}
