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
    <div className="flex flex-col gap-3 rounded border border-slate-800 p-4">
      <p className="text-xs text-slate-400">
        {title} · {index + 1}/{lines.length}
      </p>
      <p aria-live="polite" className="min-h-12 text-slate-100">
        {lines[index]}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (isLast ? onDone() : setIndex(index + 1))}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {isLast ? 'Continuar' : 'Próximo'}
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={onDone}
            className="rounded px-4 py-2 text-slate-400 outline-none hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Pular cena
          </button>
        )}
      </div>
    </div>
  )
}
