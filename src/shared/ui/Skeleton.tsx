/**
 * Placeholder lines shown while a section's first load is in flight. One live-region
 * label for assistive tech; the pulsing bars themselves are decorative.
 */
export function Skeleton({ lines = 3, label = 'Carregando…' }: { lines?: number; label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-4 animate-pulse rounded-control bg-surface-raised motion-reduce:animate-none"
          style={{ width: `${100 - index * 15}%` }}
        />
      ))}
    </div>
  )
}
