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
    <section
      className={`flex min-w-0 flex-col gap-3 rounded border border-slate-800 p-4 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-100">{title}</h2>
        <Link
          to={linkTo}
          className="shrink-0 text-sm text-emerald-400 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {linkLabel}
        </Link>
      </div>

      {isLoading ? (
        <Skeleton label={`Carregando ${title.toLowerCase()}…`} />
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-400">
          <span>{toFriendlyErrorMessage(error)}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
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
