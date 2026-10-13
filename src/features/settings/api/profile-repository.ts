import { supabase } from '@/shared/lib/supabase-client'
import type { FocusPreferencesInput } from '../schemas'
import type { Profile } from '../types'

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Replaces the `focus` key inside `settings` while preserving any other keys stored there. */
export async function updateFocusPreferences(
  id: string,
  preferences: FocusPreferencesInput,
): Promise<Profile> {
  const current = await getProfile(id)
  const currentSettings =
    current?.settings && typeof current.settings === 'object' ? current.settings : {}

  const { data, error } = await supabase
    .from('profiles')
    .update({ settings: { ...currentSettings, focus: preferences } })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateTimezone(id: string, timezone: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}
