import { z } from 'zod'

const encounterKindSchema = z.enum(['wild', 'trainer', 'rival', 'gymLeader', 'milestone'])

// The stored encounter this battle is fought against. The database takes the campaign
// node, encounter kind/difficulty and wild species from it, and rejects encounters
// that are not open (enforce_campaign_node_on_battle).
const encounterIdSchema = z.string().uuid()

// Mirrors the `battles` table constraints: exactly one of task_id/focus_session_id,
// matching commitment_type — see supabase/migrations/..._create_battles.sql.
export const createBattleInputSchema = z.discriminatedUnion('commitmentType', [
  z.object({
    commitmentType: z.literal('task'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDifficulty: z.number().int().min(1).max(5),
    taskId: z.string().uuid(),
    encounterId: encounterIdSchema,
  }),
  z.object({
    commitmentType: z.literal('focusSession'),
    encounterKind: encounterKindSchema,
    encounterDifficulty: z.number().int().min(1).max(5),
    minDurationMinutes: z.number().int().min(1).max(120),
    focusSessionId: z.string().uuid(),
    encounterId: encounterIdSchema,
  }),
])

export type CreateBattleInput = z.infer<typeof createBattleInputSchema>
