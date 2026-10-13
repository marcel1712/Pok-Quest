import { z } from 'zod'

const encounterKindSchema = z.enum(['wild', 'trainer', 'rival', 'gymLeader', 'milestone'])

// The campaign node the encounter belongs to. The database re-derives the encounter
// kind/difficulty from it and rejects locked nodes (enforce_campaign_node_on_battle).
const campaignNodeIdSchema = z.string().min(1)

// Mirrors the `battles` table constraints: exactly one of task_id/focus_session_id,
// matching commitment_type — see supabase/migrations/..._create_battles.sql.
export const createBattleInputSchema = z.discriminatedUnion('commitmentType', [
  z.object({
    commitmentType: z.literal('task'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDifficulty: z.number().int().min(1).max(5),
    taskId: z.string().uuid(),
    campaignNodeId: campaignNodeIdSchema,
  }),
  z.object({
    commitmentType: z.literal('focusSession'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDurationMinutes: z.number().int().min(1).max(120),
    focusSessionId: z.string().uuid(),
    campaignNodeId: campaignNodeIdSchema,
  }),
])

export type CreateBattleInput = z.infer<typeof createBattleInputSchema>
