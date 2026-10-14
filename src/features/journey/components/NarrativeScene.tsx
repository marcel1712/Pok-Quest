import { useState } from 'react'

/**
 * A short story scene, one line at a time. Always skippable — it never stands between
 * the player and a focus session for longer than one click.
 */
export function NarrativeScene({
  title,
  lines,
  onDone,
}: {
  title: string
  lines: string[]
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const isLast = index >= lines.length - 1

  return (
    <div className="card flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        {title} · {index + 1}/{lines.length}
      </p>
      <p aria-live="polite" className="min-h-12 text-ink">
        {lines[index]}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (isLast ? onDone() : setIndex(index + 1))}
          className="btn btn-primary"
        >
          {isLast ? 'Continuar' : 'Próximo'}
        </button>
        {!isLast && (
          <button type="button" onClick={onDone} className="btn btn-ghost">
            Pular cena
          </button>
        )}
      </div>
    </div>
  )
}
