import { useState } from 'react'
import { ActiveSessionPanel } from '@/features/focus/components/ActiveSessionPanel'
import { FocusHistorySummary } from '@/features/focus/components/FocusHistorySummary'
import { RestBreakPrompt } from '@/features/focus/components/RestBreakPrompt'
import { RestBreakTimer } from '@/features/focus/components/RestBreakTimer'
import { StartSessionForm } from '@/features/focus/components/StartSessionForm'
import { useActiveFocusSession } from '@/features/focus/hooks/use-active-focus-session'
import { useCompletionChime } from '@/features/focus/hooks/use-completion-chime'
import { useSessionClock } from '@/features/focus/hooks/use-session-clock'
import {
  useFocusPreferences,
  useUpdateFocusPreferences,
} from '@/features/settings/hooks/use-focus-preferences'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'

type RestState = { phase: 'none' } | { phase: 'prompt' } | { phase: 'resting'; minutes: number }

export function FocusPage() {
  const { data: activeSession, isLoading, isError, error } = useActiveFocusSession()
  const { preferences } = useFocusPreferences()
  const updatePreferences = useUpdateFocusPreferences()
  const clock = useSessionClock(activeSession ?? null)
  const [rest, setRest] = useState<RestState>({ phase: 'none' })

  useCompletionChime(
    clock?.phase ?? 'cancelled',
    preferences.soundEnabled && Boolean(activeSession),
  )

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

      {!isLoading && !activeSession && rest.phase === 'none' && (
        <div className="rounded border border-slate-800 p-4">
          <StartSessionForm />
        </div>
      )}

      {!activeSession && rest.phase === 'prompt' && (
        <RestBreakPrompt
          shortMinutes={preferences.restBreakMinutes.short}
          longMinutes={preferences.restBreakMinutes.long}
          onStart={(minutes) => setRest({ phase: 'resting', minutes })}
          onSkip={() => setRest({ phase: 'none' })}
        />
      )}

      {!activeSession && rest.phase === 'resting' && (
        <RestBreakTimer
          minutes={rest.minutes}
          onDone={() => setRest({ phase: 'none' })}
          onSkip={() => setRest({ phase: 'none' })}
        />
      )}

      {activeSession && (
        <ActiveSessionPanel
          session={activeSession}
          reduceMotion={preferences.reduceMotion}
          onConfirmed={() => setRest({ phase: 'prompt' })}
        />
      )}

      <FocusHistorySummary />

      <p className="text-center text-xs text-slate-500">
        Encontro e equipe aparecerão aqui quando a jornada Pokémon for implementada (Fase 4). O foco
        funciona normalmente sem isso.
      </p>
    </section>
  )
}
