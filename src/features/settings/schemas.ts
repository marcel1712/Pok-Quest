import { z } from 'zod'
import { DEFAULT_FOCUS_PREFERENCES, type FocusPreferences } from './types'

// Mirrors the safe duration bounds already enforced by focus_sessions.planned_duration_seconds
// (60–7200s, i.e. 1–120 min) — see supabase/migrations/..._create_focus_sessions.sql.
const presetMinutesSchema = z.number().int().min(1).max(120)

export const focusPreferencesSchema = z.object({
  presetsMinutes: z.array(presetMinutesSchema).min(1).max(8),
  restBreakMinutes: z.object({
    short: z.number().int().min(1).max(60),
    long: z.number().int().min(1).max(60),
  }),
  soundEnabled: z.boolean(),
  reduceMotion: z.boolean(),
})

export type FocusPreferencesInput = z.infer<typeof focusPreferencesSchema>

export const timezoneSchema = z.string().min(1).max(100)

/**
 * Reads `profiles.settings.focus` leniently: merges whatever is stored on top of the
 * defaults, then validates the merged result as a whole. Missing keys fall back to
 * defaults; if the stored blob is corrupted/invalid in a way that fails validation
 * entirely, falls back to defaults rather than throwing — this is a low-stakes
 * preferences blob, not game state that needs strict integrity.
 */
export function parseFocusPreferences(settings: unknown): FocusPreferences {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>).focus
      : undefined
  const merged = {
    ...DEFAULT_FOCUS_PREFERENCES,
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  }
  const result = focusPreferencesSchema.safeParse(merged)
  return result.success ? result.data : DEFAULT_FOCUS_PREFERENCES
}
