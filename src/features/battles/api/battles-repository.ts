import { supabase } from '@/shared/lib/supabase-client'
import type { CreateBattleInput } from '../schemas'
import type { Battle, BattleInsert } from '../types'

/**
 * Declares the commitment *before* the activity starts (RF-022). Granting XP never
 * happens here — only the DB triggers (resolve_battle_on_*_completed, SECURITY
 * DEFINER) can move a battle to `resolved`; this is a plain RLS-governed insert.
 */
export async function createBattle(ownerId: string, input: CreateBattleInput): Promise<Battle> {
  const insert: BattleInsert =
    input.commitmentType === 'task'
      ? {
          owner_id: ownerId,
          encounter_kind: input.encounterKind,
          encounter_difficulty: input.encounterDifficulty,
          commitment_type: 'task',
          commitment_min_difficulty: input.minDifficulty,
          task_id: input.taskId,
          campaign_node_id: input.campaignNodeId,
        }
      : {
          owner_id: ownerId,
          encounter_kind: input.encounterKind,
          encounter_difficulty: input.encounterDifficulty,
          commitment_type: 'focusSession',
          commitment_min_duration_minutes: input.minDurationMinutes,
          focus_session_id: input.focusSessionId,
          campaign_node_id: input.campaignNodeId,
        }

  const { data, error } = await supabase.from('battles').insert(insert).select('*').single()
  if (error) throw error
  return data
}

export async function getBattleById(id: string): Promise<Battle | null> {
  const { data, error } = await supabase.from('battles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getBattleForTask(taskId: string): Promise<Battle | null> {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getBattleForFocusSession(focusSessionId: string): Promise<Battle | null> {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('focus_session_id', focusSessionId)
    .maybeSingle()
  if (error) throw error
  return data
}
