import { z } from 'zod'

// Mirrors the `focus_sessions.planned_duration_seconds` check constraint.
export const startSessionInputSchema = z.object({
  plannedDurationSeconds: z.number().int().min(60).max(7200),
  taskId: z.string().uuid().optional().nullable(),
})

export type StartSessionInput = z.infer<typeof startSessionInputSchema>
