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

export const wildEncounterSchema = z
  .object({
    /** National Pokédex number; must exist in species-index.ts (the catalog). */
    species: z.number().int().positive(),
    minLevel: z.number().int().min(1).max(100),
    maxLevel: z.number().int().min(1).max(100),
    /** Relative appearance weight within the node — higher is more common. */
    weight: z.number().int().min(1).max(100),
  })
  .refine((entry) => entry.minLevel <= entry.maxLevel, 'minLevel must not exceed maxLevel')

const sceneLinesSchema = z.array(z.string().min(1).max(200)).min(1).max(6)

/** Short narrative shown before (`intro`) and after (`outro`) a node. Skippable. */
export const sceneSchema = z.object({
  intro: sceneLinesSchema,
  outro: sceneLinesSchema.optional(),
})

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
  /** Which species a wild encounter on this node can be. Required for wild nodes. */
  wildEncounters: z.array(wildEncounterSchema).optional(),
  /** The badge awarded for completing the node. Required for gyms, and only there. */
  badgeName: z.string().min(1).optional(),
  scene: sceneSchema.optional(),
})

export const campaignRegionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Bump whenever the content changes, then regenerate the seed migration. */
  contentVersion: z.number().int().min(1),
  /** Array order is the display/story order (`sort_order` in the database). */
  nodes: z.array(campaignNodeSchema).min(1),
})

export type SceneContent = z.infer<typeof sceneSchema>
export type WildEncounterContent = z.infer<typeof wildEncounterSchema>
export type CampaignNodeKind = z.infer<typeof campaignNodeKindSchema>
export type CampaignNodeContent = z.infer<typeof campaignNodeSchema>
export type CampaignRegionContent = z.infer<typeof campaignRegionSchema>
