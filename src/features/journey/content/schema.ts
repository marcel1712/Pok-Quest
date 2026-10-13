import { z } from 'zod'

// Authoring format for campaign content (T-004/T-028). Deliberately free of `@/`
// imports: scripts/generate-campaign-seed.ts loads these files under Node, where the
// Vite alias does not exist.
export const campaignNodeKindSchema = z.enum(['story', 'route', 'rival', 'gym'])

export const campaignEncounterKindSchema = z.enum([
  'wild',
  'trainer',
  'rival',
  'gymLeader',
  'milestone',
])

const nodeIdSchema = z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/, 'expected "<region>.<slug>"')

export const campaignNodeSchema = z.object({
  id: nodeIdSchema,
  kind: campaignNodeKindSchema,
  title: z.string().min(1),
  /** Short original text — inspired by the games' milestones, never copied dialogue. */
  summary: z.string().min(1),
  npcName: z.string().min(1).optional(),
  encounter: z.object({
    kind: campaignEncounterKindSchema,
    difficulty: z.number().int().min(1).max(5),
  }),
  /** Victories needed to complete the node (and unlock whatever requires it). */
  requiredVictories: z.number().int().min(1).max(20),
  /** Repeatable nodes stay playable after completion (free exploration). */
  repeatable: z.boolean(),
  requires: z.array(nodeIdSchema),
})

export const campaignRegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Bump whenever the content changes, then regenerate the seed migration. */
  contentVersion: z.number().int().min(1),
  /** Array order is the display/story order (`sort_order` in the database). */
  nodes: z.array(campaignNodeSchema).min(1),
})

export type CampaignNodeKind = z.infer<typeof campaignNodeKindSchema>
export type CampaignNodeContent = z.infer<typeof campaignNodeSchema>
export type CampaignRegionContent = z.infer<typeof campaignRegionSchema>
