/**
 * A labelled 0–100 bar. The fill eases to a new value so a change (XP gained, a step
 * completed) reads as progress rather than a jump; reduced-motion settings turn the
 * easing off globally (see styles/index.css).
 */
export function ProgressBar({
  value,
  label,
  size = 'md',
}: {
  /** 0–100; out-of-range values are clamped. */
  value: number
  /** Accessible name — what this bar measures. */
  label: string
  size?: 'sm' | 'md'
}) {
  const percent = Math.round(Math.min(100, Math.max(0, value)))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`w-full overflow-hidden rounded-full bg-surface-raised ${size === 'sm' ? 'h-1' : 'h-2'}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
