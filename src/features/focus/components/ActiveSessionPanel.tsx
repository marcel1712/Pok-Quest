import { useState } from 'react'
import { useTask } from '@/features/tasks/hooks/use-task'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { formatDuration } from '../format'
import {
  useCancelFocusSession,
  useConfirmFocusSession,
  usePauseFocusSession,
  useResumeFocusSession,
} from '../hooks/use-focus-session-mutations'
import { useSessionClock } from '../hooks/use-session-clock'
import type { FocusSession } from '../types'

export function ActiveSessionPanel({
  session,
  reduceMotion = false,
  onConfirmed,
}: {
  session: FocusSession
  reduceMotion?: boolean
  onConfirmed?: (session: FocusSession) => void
}) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const clock = useSessionClock(session)
  const { data: linkedTask } = useTask(session.task_id)

  const pause = usePauseFocusSession()
  const resume = useResumeFocusSession()
  const confirm = useConfirmFocusSession(onConfirmed)
  const cancel = useCancelFocusSession()

  if (!clock) return null

  const progressPercent = Math.min(
    100,
    Math.round((clock.elapsedSeconds / session.planned_duration_seconds) * 100),
  )
  const mutationError = pause.error ?? resume.error ?? confirm.error ?? cancel.error
  const isBusy = pause.isPending || resume.isPending || confirm.isPending || cancel.isPending

  return (
    <div className="card flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <p className="text-sm text-ink-muted">
          {clock.phase === 'paused' && 'Pausado'}
          {clock.phase === 'running' && 'Em foco'}
          {clock.phase === 'awaiting_confirmation' && 'Tempo esgotado!'}
        </p>
        {linkedTask && <p className="mt-1 text-sm text-ink-muted">Tarefa: {linkedTask.title}</p>}
      </div>

      <p className="text-6xl font-bold text-ink tabular-nums" role="timer">
        {clock.phase === 'awaiting_confirmation' ? '00:00' : formatDuration(clock.remainingSeconds)}
      </p>

      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-control bg-surface-raised"
      >
        <div
          className="h-full bg-accent motion-reduce:transition-none"
          style={{
            width: `${progressPercent}%`,
            transition: reduceMotion ? 'none' : 'width 1s linear',
          }}
        />
      </div>

      {mutationError && (
        <p role="alert" className="text-sm text-danger">
          {toFriendlyErrorMessage(mutationError)}
        </p>
      )}

      {clock.phase === 'awaiting_confirmation' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-ink-soft">O tempo planejado terminou. Confirma a conclusão?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => confirm.mutate(session)}
              disabled={isBusy}
              className="btn btn-primary btn-lg"
            >
              Confirmar conclusão
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isBusy}
              className="btn btn-ghost btn-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(clock.phase === 'running' || clock.phase === 'paused') && (
        <div className="flex gap-3">
          {clock.phase === 'running' ? (
            <button
              type="button"
              onClick={() => pause.mutate(session)}
              disabled={isBusy}
              className="btn btn-secondary btn-lg"
            >
              Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resume.mutate(session)}
              disabled={isBusy}
              className="btn btn-primary btn-lg"
            >
              Retomar
            </button>
          )}

          {!isConfirmingCancel && (
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isBusy}
              className="btn btn-ghost btn-lg"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {isConfirmingCancel && (
        <div className="flex items-center gap-3 rounded-control border border-line bg-surface/50 p-3">
          <span className="text-ink-soft">Cancelar esta sessão? O tempo não será aproveitado.</span>
          <button
            type="button"
            onClick={() => {
              cancel.mutate(session)
              setIsConfirmingCancel(false)
            }}
            className="font-semibold text-danger hover:underline"
          >
            Sim, cancelar
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmingCancel(false)}
            className="text-ink-muted hover:text-ink"
          >
            Voltar
          </button>
        </div>
      )}

      <p className="max-w-sm text-center text-xs text-ink-muted">
        Você não precisa manter esta aba aberta ou a tela ativa: o progresso é calculado pela hora
        de início salva no servidor, não por um cronômetro local.
      </p>
    </div>
  )
}
