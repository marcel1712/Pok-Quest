import type { Tables, TablesUpdate } from '@/shared/types/database'

export type Profile = Tables<'profiles'>
export type ProfileUpdate = TablesUpdate<'profiles'>

export type FocusPreferences = {
  presetsMinutes: number[]
  restBreakMinutes: { short: number; long: number }
  soundEnabled: boolean
  reduceMotion: boolean
}

export const DEFAULT_FOCUS_PREFERENCES: FocusPreferences = {
  presetsMinutes: [25, 30, 45, 60],
  restBreakMinutes: { short: 5, long: 15 },
  soundEnabled: false,
  reduceMotion: false,
}
