import { campaignRegionSchema } from './schema.ts'
import { SPECIES_INDEX } from './species-index.ts'
import type { CampaignNodeContent, CampaignNodeKind, CampaignRegionContent } from './schema.ts'

const ALLOWED_ENCOUNTER_KINDS: Record<
  CampaignNodeKind,
  CampaignNodeContent['encounter']['kind'][]
> = {
  story: ['milestone', 'trainer'],
  route: ['wild', 'trainer'],
  rival: ['rival'],
  gym: ['gymLeader'],
}

/**
 * Content-level checks the type system can't express: broken links, nodes nobody can
 * ever reach, and story-order mistakes. Returns human-readable issues (empty = valid)
 * instead of throwing, so the seed script and the tests can report all of them at once.
 */
export function validateCampaignRegion(input: unknown): string[] {
  const parsed = campaignRegionSchema.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  }

  const region: CampaignRegionContent = parsed.data
  const issues: string[] = []
  const indexById = new Map<string, number>()

  region.nodes.forEach((node, index) => {
    if (indexById.has(node.id)) issues.push(`${node.id}: duplicate node id`)
    else indexById.set(node.id, index)

    if (!node.id.startsWith(`${region.id}.`)) {
      issues.push(`${node.id}: id must be prefixed with the region id "${region.id}."`)
    }
    if (!ALLOWED_ENCOUNTER_KINDS[node.kind].includes(node.encounter.kind)) {
      issues.push(`${node.id}: a ${node.kind} node cannot have a ${node.encounter.kind} encounter`)
    }
    if (node.repeatable && node.kind !== 'route') {
      issues.push(`${node.id}: only route nodes can be repeatable`)
    }
    const wildEncounters = node.wildEncounters ?? []
    if (node.encounter.kind === 'wild' && wildEncounters.length === 0) {
      issues.push(node.id + ': a wild node needs at least one wild encounter entry')
    }
    if (node.encounter.kind !== 'wild' && wildEncounters.length > 0) {
      issues.push(node.id + ': only wild nodes can list wild encounters')
    }
    const seenSpecies = new Set<number>()
    for (const entry of wildEncounters) {
      const species = SPECIES_INDEX[entry.species]
      if (!species) {
        issues.push(node.id + ': species #' + entry.species + ' is not in the catalog')
      } else if (species.legendary) {
        // Legendaries only ever appear as scripted story milestones, never by chance.
        issues.push(node.id + ': ' + species.name + ' is legendary and cannot be a wild encounter')
      }
      if (seenSpecies.has(entry.species)) {
        issues.push(node.id + ': species #' + entry.species + ' is listed twice')
      }
      seenSpecies.add(entry.species)
    }
    if (new Set(node.requires).size !== node.requires.length) {
      issues.push(`${node.id}: duplicate prerequisite`)
    }
  })

  region.nodes.forEach((node, index) => {
    for (const requiredId of node.requires) {
      const requiredIndex = indexById.get(requiredId)
      if (requiredId === node.id) {
        issues.push(`${node.id}: requires itself`)
      } else if (requiredIndex === undefined) {
        issues.push(`${node.id}: requires unknown node "${requiredId}"`)
      } else if (requiredIndex > index) {
        issues.push(`${node.id}: requires "${requiredId}", which comes later in the story order`)
      }
    }
  })

  if (!region.nodes.some((node) => node.requires.length === 0)) {
    issues.push('no starting node: at least one node must have no prerequisites')
  }

  // Simulate a full playthrough; whatever never unlocks is unreachable (covers cycles
  // and nodes hanging off a broken link alike).
  const completed = new Set<string>()
  let progressed = true
  while (progressed) {
    progressed = false
    for (const node of region.nodes) {
      if (!completed.has(node.id) && node.requires.every((id) => completed.has(id))) {
        completed.add(node.id)
        progressed = true
      }
    }
  }
  for (const node of region.nodes) {
    if (!completed.has(node.id)) issues.push(`${node.id}: unreachable`)
  }

  return issues
}
