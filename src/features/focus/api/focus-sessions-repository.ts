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

export async function updateSession(id: string, patch: FocusSessionUpdate): Promise<FocusSession> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}
