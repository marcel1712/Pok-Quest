import { z } from 'zod'

// Mirrors the `tasks` table constraints (supabase/migrations/..._create_tasks.sql) so bad
// input is rejected client-side with the same limits the database enforces.
const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, 'O título é obrigatório.').max(200, 'Título muito longo.'),
  description: z
    .string()
    .trim()
    .max(5000, 'Descrição muito longa.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  categoryId: z.string().uuid().optional().nullable(),
  difficulty: z.number().int().min(1).max(5),
  dueDate: z.string().date().optional().nullable(),
})

export const taskInputSchema = taskFieldsSchema.extend({
  difficulty: taskFieldsSchema.shape.difficulty.default(2),
})

export type TaskInput = z.infer<typeof taskInputSchema>

// Built from the same field schemas (not `.partial()` on taskInputSchema) so an empty
// patch stays empty instead of picking up `difficulty`'s default.
export const taskUpdateSchema = taskFieldsSchema.partial()

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
