import { z } from 'zod'

const encounterKindSchema = z.enum(['wild', 'trainer', 'rival', 'gymLeader', 'milestone'])

// Mirrors the `battles` table constraints: exactly one of task_id/focus_session_id,
// matching commitment_type — see supabase/migrations/..._create_battles.sql.
export const createBattleInputSchema = z.discriminatedUnion('commitmentType', [
  z.object({
    commitmentType: z.literal('task'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDifficulty: z.number().int().min(1).max(5),
    taskId: z.string().uuid(),
  }),
  z.object({
    commitmentType: z.literal('focusSession'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDurationMinutes: z.number().int().min(1).max(120),
    focusSessionId: z.string().uuid(),
  }),
])

export type CreateBattleInput = z.infer<typeof createBattleInputSchema>
