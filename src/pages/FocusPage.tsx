import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BattleResultSection } from '@/features/battles/components/BattleResultSection'
import { EncounterCard } from '@/features/battles/components/EncounterCard'
import { useCreateBattle } from '@/features/battles/hooks/use-create-battle'
import { useBattleForFocusSession } from '@/features/battles/hooks/use-battle'
import { ENCOUNTER_LABELS } from '@/features/battles/labels'
import type { Commitment, Encounter, EncounterKind } from '@/features/battles/types'
import { ActiveSessionPanel } from '@/features/focus/components/ActiveSessionPanel'
import { FocusHistorySummary } from '@/features/focus/components/FocusHistorySummary'
import { RestBreakPrompt } from '@/features/focus/components/RestBreakPrompt'
import { RestBreakTimer } from '@/features/focus/components/RestBreakTimer'
import { StartSessionForm } from '@/features/focus/components/StartSessionForm'
import { useActiveFocusSession } from '@/features/focus/hooks/use-active-focus-session'
import { useCompletionChime } from '@/features/focus/hooks/use-completion-chime'
import { useStartFocusSession } from '@/features/focus/hooks/use-focus-session-mutations'
import { useSessionClock } from '@/features/focus/hooks/use-session-clock'
import { NarrativeScene } from '@/features/journey/components/NarrativeScene'
import { VictoryEpilogue } from '@/features/journey/components/VictoryEpilogue'
import { useCurrentEncounter } from '@/features/journey/hooks/use-current-encounter'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { useSeenScenes } from '@/features/journey/hooks/use-seen-scenes'
import { useSpeciesByPokedexNumber } from '@/features/pokemon/hooks/use-species-catalog'
import {
  useFocusPreferences,
  useUpdateFocusPreferences,
} from '@/features/settings/hooks/use-focus-preferences'
import { queryKeys } from '@/shared/lib/query-keys'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'

type RestState =
  | { phase: 'none' }
  | { phase: 'battleResult'; focusSessionId: string }
  | { phase: 'prompt' }
  | { phase: 'resting'; minutes: number }

// The party's level is not applied to the shown commitment yet — always neutral. The
// database accepts this: its own minimum can only be equal or lower (team reduction).
const NO_PARTY = { averageLevel: 0 }

export function FocusPage() {
  const queryClient = useQueryClient()
  const { data: activeSession, isLoading, isError, error } = useActiveFocusSession()
  const { data: linkedBattle } = useBattleForFocusSession(activeSession?.id)
  const { preferences } = useFocusPreferences()
  const updatePreferences = useUpdateFocusPreferences()
  const clock = useSessionClock(activeSession ?? null)
  const [rest, setRest] = useState<RestState>({ phase: 'none' })
  // The encounter is generated and stored by the server (where it happens, and which
  // wild Pokémon appears), so a refresh never rerolls it. No encounter (still loading,
  // failed, no campaign) just means focusing without one: productivity never waits on
  // the RPG.
  const { data: currentEncounter, isLoading: isEncounterLoading } = useCurrentEncounter()
  const { journey } = useJourney()
  const { data: wildSpecies } = useSpeciesByPokedexNumber(
    currentEncounter?.wild_species_pokedex_number,
  )
  const encounter: Encounter | null = currentEncounter
    ? {
        kind: currentEncounter.encounter_kind as EncounterKind,
        difficulty: currentEncounter.encounter_difficulty,
      }
    : null
  const encounterNode = journey.find(
    (entry) => entry.node.id === currentEncounter?.campaign_node_id,
  )?.node
  const { hasSeen, markSeen } = useSeenScenes()
  const [encounterSkipped, setEncounterSkipped] = useState(false)
  const startSession = useStartFocusSession()
  const createBattle = useCreateBattle()

  useCompletionChime(
    clock?.phase ?? 'cancelled',
    preferences.soundEnabled && Boolean(activeSession),
  )

  function returnToIdle() {
    setEncounterSkipped(false)
    setRest({ phase: 'none' })
  }

  function handleAcceptEncounter(commitment: Commitment) {
    if (commitment.type !== 'focusSession' || !currentEncounter || !encounter) return
    const encounterId = currentEncounter.id
    startSession.mutate(
      { plannedDurationSeconds: commitment.minDurationMinutes * 60, taskId: null },
      {
        onSuccess: (session) => {
          createBattle.mutate({
            commitmentType: 'focusSession',
            encounterKind: encounter.kind,
            encounterDifficulty: encounter.difficulty,
            minDurationMinutes: commitment.minDurationMinutes,
            focusSessionId: session.id,
            encounterId,
          })
        },
      },
    )
  }

  function handleConfirmed() {
    if (!activeSession) return
    queryClient.invalidateQueries({ queryKey: queryKeys.battles.forFocusSession(activeSession.id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.campaign.progress() })
    // A victory consumes the encounter; the next one is generated on this refetch.
    queryClient.invalidateQueries({ queryKey: queryKeys.campaign.encounter() })
    queryClient.invalidateQueries({ queryKey: queryKeys.campaign.badges() })
    setRest({ phase: 'battleResult', focusSessionId: activeSession.id })
  }

  const isIdleLoading = isLoading || (!activeSession && isEncounterLoading)
  const isIdle = !isIdleLoading && !activeSession && rest.phase === 'none'
  const isEncounterOffered = isIdle && encounter && currentEncounter && !encounterSkipped
  const introScene =
    encounterNode && encounterNode.scene_intro.length > 0 && !hasSeen(encounterNode.id)
      ? encounterNode
      : null

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Foco</h1>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={preferences.soundEnabled}
            onChange={(event) =>
              updatePreferences.mutate({ ...preferences, soundEnabled: event.target.checked })
            }
          />
          Som ao terminar
        </label>
      </div>

      {isIdleLoading && <p className="text-slate-400">Carregando…</p>}

      {isError && (
        <p role="alert" className="text-red-400">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      {isEncounterOffered && introScene && (
        <NarrativeScene
          key={introScene.id}
          title={introScene.title}
          lines={introScene.scene_intro}
          onDone={() => markSeen(introScene.id)}
        />
      )}

      {isEncounterOffered && !introScene && (
        <EncounterCard
          encounter={encounter}
          locationName={encounterNode?.title}
          opponentName={encounterNode?.npc_name ?? undefined}
          rewardText={
            encounterNode?.badge_name ? `${encounterNode.badge_name} + XP de bônus` : undefined
          }
          wild={
            wildSpecies && currentEncounter.wild_level
              ? { species: wildSpecies, level: currentEncounter.wild_level }
              : undefined
          }
          party={NO_PARTY}
          commitmentType="focusSession"
          onAccept={handleAcceptEncounter}
          onSkip={() => setEncounterSkipped(true)}
        />
      )}

      {isIdle && (!encounter || encounterSkipped) && (
        <div className="rounded border border-slate-800 p-4">
          <StartSessionForm />
        </div>
      )}

      {!activeSession && rest.phase === 'battleResult' && (
        <BattleResultSection
          focusSessionId={rest.focusSessionId}
          reduceMotion={preferences.reduceMotion}
          onNoBattle={() => setRest({ phase: 'prompt' })}
          onDismiss={() => setRest({ phase: 'prompt' })}
          renderEpilogue={(battle) => <VictoryEpilogue battle={battle} />}
        />
      )}

      {!activeSession && rest.phase === 'prompt' && (
        <RestBreakPrompt
          shortMinutes={preferences.restBreakMinutes.short}
          longMinutes={preferences.restBreakMinutes.long}
          onStart={(minutes) => setRest({ phase: 'resting', minutes })}
          onSkip={returnToIdle}
        />
      )}

      {!activeSession && rest.phase === 'resting' && (
        <RestBreakTimer minutes={rest.minutes} onDone={returnToIdle} onSkip={returnToIdle} />
      )}

      {activeSession && (
        <div className="flex flex-col gap-2">
          <ActiveSessionPanel
            session={activeSession}
            reduceMotion={preferences.reduceMotion}
            onConfirmed={handleConfirmed}
          />
          {linkedBattle && (
            <p className="text-center text-xs text-slate-500">
              Encontro: {ENCOUNTER_LABELS[linkedBattle.encounter_kind as EncounterKind].label} —
              compromisso: foco ≥ {linkedBattle.commitment_min_duration_minutes} min
            </p>
          )}
        </div>
      )}

      <FocusHistorySummary />
    </section>
  )
}
