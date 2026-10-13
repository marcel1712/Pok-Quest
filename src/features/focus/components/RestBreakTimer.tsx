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
    <div className="flex flex-col items-center gap-3 rounded border border-slate-800 p-4">
      <p className="text-slate-300">Descanso</p>
      <p className="text-4xl font-bold text-slate-100 tabular-nums" role="timer">
        {formatDuration(remaining)}
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="text-sm text-slate-400 outline-none hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        Pular descanso
      </button>
    </div>
  )
}
