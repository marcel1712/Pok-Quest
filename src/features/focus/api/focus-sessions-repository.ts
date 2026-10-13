import { supabase } from '@/shared/lib/supabase-client'
import { isPostgrestError } from '@/shared/lib/supabase-error'
import type { StartSessionInput } from '../schemas'
import type { FocusSession, FocusSessionUpdate } from '../types'

const UNIQUE_VIOLATION = '23505'

export async function getActiveSession(): Promise<FocusSession | null> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .in('status', ['running', 'paused'])
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * The DB enforces at most one active session per owner (see migrations). If this
 * insert loses that race — another tab/device already has one running — we don't
 * surface a raw conflict error: we resolve it by returning whichever session is
 * actually active, so the caller always reflects the true server state (RF-019).
 */
export async function startSession(
  ownerId: string,
  input: StartSessionInput,
): Promise<FocusSession> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({
      owner_id: ownerId,
      planned_duration_seconds: input.plannedDurationSeconds,
      task_id: input.taskId ?? null,
    })
    .select('*')
    .single()

  if (error) {
    if (isPostgrestError(error) && error.code === UNIQUE_VIOLATION) {
      const active = await getActiveSession()
      if (active) return active
    }
    throw error
  }

  return data
}

export async function getSessionById(id: string): Promise<FocusSession | null> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Applies a status transition only if the row is still in one of `fromStatuses` —
 * guards against a retried request (e.g. the client resent "confirm" after losing the
 * response to a connection drop) re-applying its own patch on top of a transition that
 * already committed. Without this, a retried confirm/pause could silently overwrite
 * `ended_at`/`paused_at` with a later timestamp, corrupting `accumulated_pause_seconds`
 * on the next resume — even though the completion *event* itself stays single thanks to
 * the DB trigger (T-013/T-016).
 *
 * When the conditional update matches zero rows, that means someone/something already
 * moved the session past `fromStatuses` — not that the request failed. We fetch and
 * return the session's current, true state instead of raising a confusing error for an
 * action that, from the user's perspective, already succeeded (RNF-006, T-019).
 */
export async function transitionSession(
  id: string,
  fromStatuses: string[],
  patch: FocusSessionUpdate,
): Promise<FocusSession> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .update(patch)
    .eq('id', id)
    .in('status', fromStatuses)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (data) return data

  const current = await getSessionById(id)
  if (!current) throw new Error('Sessão não encontrada.')
  return current
}
