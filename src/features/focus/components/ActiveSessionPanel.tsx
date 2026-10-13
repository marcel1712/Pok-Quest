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
  onConfirmed?: () => void
}) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const clock = useSessionClock(session)
  const { data: linkedTask } = useTask(session.task_id)

  const pause = usePauseFocusSession()
  const resume = useResumeFocusSession()
  const confirm = useConfirmFocusSession()
  const cancel = useCancelFocusSession()

  if (!clock) return null

  const progressPercent = Math.min(
    100,
    Math.round((clock.elapsedSeconds / session.planned_duration_seconds) * 100),
  )
  const mutationError = pause.error ?? resume.error ?? confirm.error ?? cancel.error
  const isBusy = pause.isPending || resume.isPending || confirm.isPending || cancel.isPending

  return (
    <div className="flex flex-col items-center gap-6 rounded border border-slate-800 p-6">
      <div className="text-center">
        <p className="text-sm text-slate-400">
          {clock.phase === 'paused' && 'Pausado'}
          {clock.phase === 'running' && 'Em foco'}
          {clock.phase === 'awaiting_confirmation' && 'Tempo esgotado!'}
        </p>
        {linkedTask && <p className="mt-1 text-sm text-slate-500">Tarefa: {linkedTask.title}</p>}
      </div>

      <p className="text-6xl font-bold text-slate-100 tabular-nums" role="timer">
        {clock.phase === 'awaiting_confirmation' ? '00:00' : formatDuration(clock.remainingSeconds)}
      </p>

      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded bg-slate-800"
      >
        <div
          className="h-full bg-emerald-500 motion-reduce:transition-none"
          style={{
            width: `${progressPercent}%`,
            transition: reduceMotion ? 'none' : 'width 1s linear',
          }}
        />
      </div>

      {mutationError && (
        <p role="alert" className="text-sm text-red-400">
          {toFriendlyErrorMessage(mutationError)}
        </p>
      )}

      {clock.phase === 'awaiting_confirmation' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-slate-300">O tempo planejado terminou. Confirma a conclusão?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => confirm.mutate(session, { onSuccess: () => onConfirmed?.() })}
              disabled={isBusy}
              className="rounded bg-emerald-500 px-6 py-2.5 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
            >
              Confirmar conclusão
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isBusy}
              className="rounded px-4 py-2.5 text-slate-400 hover:text-slate-200"
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
              className="rounded bg-slate-800 px-5 py-2.5 font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
            >
              Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resume.mutate(session)}
              disabled={isBusy}
              className="rounded bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
            >
              Retomar
            </button>
          )}

          {!isConfirmingCancel && (
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isBusy}
              className="rounded px-4 py-2.5 text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {isConfirmingCancel && (
        <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/50 p-3">
          <span className="text-slate-300">
            Cancelar esta sessão? O tempo não será aproveitado.
          </span>
          <button
            type="button"
            onClick={() => {
              cancel.mutate(session)
              setIsConfirmingCancel(false)
            }}
            className="font-semibold text-red-400 hover:text-red-300"
          >
            Sim, cancelar
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmingCancel(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            Voltar
          </button>
        </div>
      )}

      <p className="max-w-sm text-center text-xs text-slate-500">
        Você não precisa manter esta aba aberta ou a tela ativa: o progresso é calculado pela hora
        de início salva no servidor, não por um cronômetro local.
      </p>
    </div>
  )
}
