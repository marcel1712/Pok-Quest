import { useMemo, useState } from 'react'
import { HISTORY_FETCH_LIMIT } from '@/features/history/api/history-repository'
import { HistorySummaryPanel } from '@/features/history/components/HistorySummaryPanel'
import { HistoryTimeline } from '@/features/history/components/HistoryTimeline'
import { groupByDay, KIND_LABELS } from '@/features/history/domain'
import { useHistoryEntries, useHistorySummary } from '@/features/history/hooks/use-history'
import { HISTORY_KINDS } from '@/features/history/types'
import type { HistoryKind } from '@/features/history/types'
import { BadgeCase } from '@/features/journey/components/BadgeCase'
import { useBadges } from '@/features/journey/hooks/use-badges'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { useOwnedPokemon } from '@/features/pokemon/hooks/use-owned-pokemon'
import { useProfile } from '@/features/settings/hooks/use-profile'
import { TASK_RETENTION_DAYS } from '@/features/tasks/limits'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { Skeleton } from '@/shared/ui/Skeleton'

const WINDOW_STEP_DAYS = 30

export function HistoryPage() {
  const [days, setDays] = useState(WINDOW_STEP_DAYS)
  // null = every kind. Filtering is done over the entries already loaded: switching
  // filters never triggers a request.
  const [kind, setKind] = useState<HistoryKind | null>(null)

  const summary = useHistorySummary()
  const entries = useHistoryEntries(days)
  const profile = useProfile()
  const { journey } = useJourney()
  const { data: badges } = useBadges()
  const { data: pokemon } = useOwnedPokemon()

  const timeZone = profile.data?.timezone ?? 'UTC'
  const [nowIso] = useState(() => new Date().toISOString())

  const visibleDays = useMemo(() => {
    const filtered = (entries.data ?? []).filter((entry) => kind === null || entry.kind === kind)
    return groupByDay(filtered, timeZone)
  }, [entries.data, kind, timeZone])

  const presentKinds = new Set((entries.data ?? []).map((entry) => entry.kind))
  const highestLevel = Math.max(0, ...(pokemon ?? []).map((entry) => entry.level))

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Histórico</h1>
        <p className="mt-2 text-ink-muted">
          Tudo o que você fez, dia a dia. Dias sem atividade não aparecem — não há sequência a
          manter.
        </p>
      </div>

      {summary.isLoading && <Skeleton lines={4} label="Carregando resumo…" />}
      {summary.isError && (
        <p role="alert" className="text-danger">
          {toFriendlyErrorMessage(summary.error)}
        </p>
      )}
      {summary.data && <HistorySummaryPanel summary={summary.data} />}

      <div className="flex flex-col gap-3">
        <BadgeCase journey={journey} badges={badges ?? []} />
        {pokemon && pokemon.length > 0 && (
          <p className="text-sm text-ink-muted">
            {pokemon.length} Pokémon na coleção · nível mais alto: {highestLevel}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Filtrar histórico" className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
            className="rounded-control px-3 py-1.5 text-ink-muted hover:text-ink aria-pressed:bg-surface-raised aria-pressed:font-semibold aria-pressed:text-accent-soft"
          >
            Tudo
          </button>
          {HISTORY_KINDS.filter((candidate) => presentKinds.has(candidate)).map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={kind === candidate}
              onClick={() => setKind(candidate)}
              className="rounded-control px-3 py-1.5 text-ink-muted hover:text-ink aria-pressed:bg-surface-raised aria-pressed:font-semibold aria-pressed:text-accent-soft"
            >
              {KIND_LABELS[candidate].label}
            </button>
          ))}
        </div>

        {entries.isLoading && <Skeleton lines={5} label="Carregando histórico…" />}
        {entries.isError && (
          <p role="alert" className="text-danger">
            {toFriendlyErrorMessage(entries.error)}
          </p>
        )}

        {entries.data && visibleDays.length === 0 && (
          <p className="text-ink-muted">
            {kind === null
              ? `Nada registrado nos últimos ${days} dias.`
              : `Nada desse tipo nos últimos ${days} dias.`}
          </p>
        )}

        {visibleDays.length > 0 && (
          <HistoryTimeline days={visibleDays} timeZone={timeZone} nowIso={nowIso} />
        )}

        {entries.data && entries.data.length >= HISTORY_FETCH_LIMIT && (
          <p className="text-sm text-ink-muted">
            Mostrando os {HISTORY_FETCH_LIMIT} registros mais recentes deste período.
          </p>
        )}

        {entries.data && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={entries.isFetching}
              onClick={() => setDays(days + WINDOW_STEP_DAYS)}
              className="btn btn-outline btn-sm"
            >
              {entries.isFetching ? 'Carregando…' : `Ver mais ${WINDOW_STEP_DAYS} dias`}
            </button>
            <span className="text-sm text-ink-muted">Mostrando os últimos {days} dias.</span>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Tarefas concluídas ou arquivadas são apagadas da lista de Tarefas depois de{' '}
        {TASK_RETENTION_DAYS} dias. O registro delas continua aqui, e os totais não mudam.
      </p>
    </section>
  )
}
