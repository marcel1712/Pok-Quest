import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Shared frame for a dashboard section: heading, a link to the full page, and the
 * loading/error states. A failed section offers its own retry and never takes the
 * rest of the dashboard down with it.
 */
export function WidgetCard({
  title,
  linkTo,
  linkLabel,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  children,
}: {
  title: string
  linkTo: string
  linkLabel: string
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  /** Grid placement, decided by the page. */
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`card flex min-w-0 flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-ink">{title}</h2>
        <Link to={linkTo} className="link shrink-0 text-sm">
          {linkLabel}
        </Link>
      </div>

      {isLoading ? (
        <Skeleton label={`Carregando ${title.toLowerCase()}…`} />
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          <span>{toFriendlyErrorMessage(error)}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-outline btn-sm">
              Tentar de novo
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  )
}
