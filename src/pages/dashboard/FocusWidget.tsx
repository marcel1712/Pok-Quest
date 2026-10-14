import { Link } from 'react-router-dom'
import { ENCOUNTER_LABELS } from '@/features/battles/labels'
import type { EncounterKind } from '@/features/battles/types'
import { formatDuration } from '@/features/focus/format'
import { useActiveFocusSession } from '@/features/focus/hooks/use-active-focus-session'
import { useFocusHistory } from '@/features/focus/hooks/use-focus-history'
import { useSessionClock } from '@/features/focus/hooks/use-session-clock'
import { useCurrentEncounter } from '@/features/journey/hooks/use-current-encounter'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { useSpeciesByPokedexNumber } from '@/features/pokemon/hooks/use-species-catalog'
import { WidgetCard } from './WidgetCard'

const ACTION_CLASS =
  'self-start rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'

export function FocusWidget({ className }: { className?: string }) {
  const activeSession = useActiveFocusSession()
  const clock = useSessionClock(activeSession.data ?? null)
  const { data: encounter } = useCurrentEncounter()
  const { journey } = useJourney()
  const { data: wildSpecies } = useSpeciesByPokedexNumber(encounter?.wild_species_pokedex_number)
  const { summary } = useFocusHistory()

  const node = journey.find((entry) => entry.node.id === encounter?.campaign_node_id)?.node
  const encounterLabel = encounter
    ? wildSpecies && encounter.wild_level
      ? `${wildSpecies.name} selvagem · Nv. ${encounter.wild_level}`
      : node?.npc_name
        ? `${ENCOUNTER_LABELS[encounter.encounter_kind as EncounterKind].label}: ${node.npc_name}`
        : ENCOUNTER_LABELS[encounter.encounter_kind as EncounterKind].label
    : null

  return (
    <WidgetCard
      className={className}
      title="Foco"
      linkTo="/focus"
      linkLabel="Abrir foco"
      isLoading={activeSession.isLoading}
      error={activeSession.error}
      onRetry={() => activeSession.refetch()}
    >
      {clock ? (
        <>
          <p className="text-slate-100">
            {clock.phase === 'awaiting_confirmation'
              ? 'O tempo planejado terminou. Falta confirmar a conclusão.'
              : clock.phase === 'paused'
                ? `Sessão pausada · faltam ${formatDuration(clock.remainingSeconds)}`
                : `Sessão em andamento · faltam ${formatDuration(clock.remainingSeconds)}`}
          </p>
          <Link to="/focus" className={ACTION_CLASS}>
            Voltar à sessão
          </Link>
        </>
      ) : (
        <>
          {encounterLabel ? (
            <p className="text-slate-100">
              <span className="text-slate-400">Próximo encontro: </span>
              {encounterLabel}
              {node && <span className="text-slate-400"> — {node.title}</span>}
            </p>
          ) : (
            <p className="text-slate-400">Nenhum encontro à espera. Dá para focar mesmo assim.</p>
          )}
          <Link to="/focus" className={ACTION_CLASS}>
            Iniciar foco
          </Link>
        </>
      )}

      {summary && (
        <p className="text-sm text-slate-400">
          Hoje: {summary.today.focusedMinutes} min em {summary.today.sessionCount}{' '}
          {summary.today.sessionCount === 1 ? 'sessão' : 'sessões'}
        </p>
      )}
    </WidgetCard>
  )
}
