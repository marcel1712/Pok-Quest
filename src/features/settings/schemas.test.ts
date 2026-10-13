import { describe, expect, it } from 'vitest'
import { parseFocusPreferences } from './schemas'
import { DEFAULT_FOCUS_PREFERENCES } from './types'

describe('parseFocusPreferences', () => {
  it('falls back to defaults when settings is empty', () => {
    expect(parseFocusPreferences({})).toEqual(DEFAULT_FOCUS_PREFERENCES)
  })

  it('falls back to defaults when settings is null', () => {
    expect(parseFocusPreferences(null)).toEqual(DEFAULT_FOCUS_PREFERENCES)
  })

  it('merges stored focus preferences on top of defaults', () => {
    const result = parseFocusPreferences({ focus: { soundEnabled: true } })
    expect(result.soundEnabled).toBe(true)
    expect(result.presetsMinutes).toEqual(DEFAULT_FOCUS_PREFERENCES.presetsMinutes)
  })

  it('accepts a fully custom valid preference set', () => {
    const custom = {
      presetsMinutes: [10, 20],
      restBreakMinutes: { short: 3, long: 20 },
      soundEnabled: true,
      reduceMotion: true,
    }
    expect(parseFocusPreferences({ focus: custom })).toEqual(custom)
  })

  it('falls back to defaults entirely when the stored data is invalid', () => {
    const result = parseFocusPreferences({ focus: { presetsMinutes: [0, -5] } })
    expect(result).toEqual(DEFAULT_FOCUS_PREFERENCES)
  })
})
