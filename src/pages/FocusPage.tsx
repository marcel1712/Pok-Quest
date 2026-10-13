import { useState } from 'react'
import { ActiveSessionPanel } from '@/features/focus/components/ActiveSessionPanel'
import { StartSessionForm } from '@/features/focus/components/StartSessionForm'
import { useActiveFocusSession } from '@/features/focus/hooks/use-active-focus-session'
import { useCompletionChime } from '@/features/focus/hooks/use-completion-chime'
import { useSessionClock } from '@/features/focus/hooks/use-session-clock'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'

export function FocusPage() {
  const { data: activeSession, isLoading, isError, error } = useActiveFocusSession()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const clock = useSessionClock(activeSession ?? null)

  useCompletionChime(clock?.phase ?? 'cancelled', soundEnabled && Boolean(activeSession))

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Foco</h1>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
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

      {!isLoading && !activeSession && (
        <div className="rounded border border-slate-800 p-4">
          <StartSessionForm />
        </div>
      )}

      {activeSession && <ActiveSessionPanel session={activeSession} />}

      <p className="text-center text-xs text-slate-500">
        Encontro e equipe aparecerão aqui quando a jornada Pokémon for implementada (Fase 4). O foco
        funciona normalmente sem isso.
      </p>
    </section>
  )
}
