import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database'

export type FocusSession = Tables<'focus_sessions'>
export type FocusSessionInsert = TablesInsert<'focus_sessions'>
export type FocusSessionUpdate = TablesUpdate<'focus_sessions'>

/** Persisted states only. `awaiting_confirmation` is derived — see domain.ts. */
export type FocusSessionStatus = 'running' | 'paused' | 'completed' | 'cancelled'

/** The full state-machine phase shown to the UI, including the derived state. */
export type FocusSessionPhase =
  'running' | 'paused' | 'awaiting_confirmation' | 'completed' | 'cancelled'
