import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BattleResultSection } from '@/features/battles/components/BattleResultSection'
import { EncounterCard } from '@/features/battles/components/EncounterCard'
import { generateRandomEncounter } from '@/features/battles/encounter-generator'
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

// No party system yet (T-024/T-025) — always neutral, matching docs/GAME_RULES.md.
const NO_PARTY = { averageLevel: 0 }

export function FocusPage() {
  const queryClient = useQueryClient()
  const { data: activeSession, isLoading, isError, error } = useActiveFocusSession()
  const { data: linkedBattle } = useBattleForFocusSession(activeSession?.id)
  const { preferences } = useFocusPreferences()
  const updatePreferences = useUpdateFocusPreferences()
  const clock = useSessionClock(activeSession ?? null)
  const [rest, setRest] = useState<RestState>({ phase: 'none' })
  const [encounter, setEncounter] = useState<Encounter>(() => generateRandomEncounter())
  const [encounterSkipped, setEncounterSkipped] = useState(false)
  const startSession = useStartFocusSession()
  const createBattle = useCreateBattle()

  useCompletionChime(
    clock?.phase ?? 'cancelled',
    preferences.soundEnabled && Boolean(activeSession),
  )

  function returnToIdle() {
    setEncounter(generateRandomEncounter())
    setEncounterSkipped(false)
    setRest({ phase: 'none' })
  }

  function handleAcceptEncounter(commitment: Commitment) {
    if (commitment.type !== 'focusSession') return
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
          })
        },
      },
    )
  }

  function handleConfirmed() {
    if (!activeSession) return
    queryClient.invalidateQueries({ queryKey: queryKeys.battles.forFocusSession(activeSession.id) })
    setRest({ phase: 'battleResult', focusSessionId: activeSession.id })
  }

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

      {isLoading && <p className="text-slate-400">Carregando…</p>}

      {isError && (
        <p role="alert" className="text-red-400">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      {!isLoading && !activeSession && rest.phase === 'none' && !encounterSkipped && (
        <EncounterCard
          encounter={encounter}
          party={NO_PARTY}
          commitmentType="focusSession"
          onAccept={handleAcceptEncounter}
          onSkip={() => setEncounterSkipped(true)}
        />
      )}

      {!isLoading && !activeSession && rest.phase === 'none' && encounterSkipped && (
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
