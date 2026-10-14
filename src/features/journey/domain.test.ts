import { describe, expect, it } from 'vitest'
import { buildJourney, pickObjective } from './domain'
import type { CampaignContent, CampaignNode, CampaignNodeProgress } from './types'

function node(id: string, sortOrder: number, overrides: Partial<CampaignNode> = {}): CampaignNode {
  return {
    id,
    region_id: 'sinnoh',
    sort_order: sortOrder,
    kind: 'route',
    title: id,
    summary: '',
    npc_name: null,
    encounter_kind: 'wild',
    encounter_difficulty: 1,
    required_victories: 3,
    repeatable: false,
    badge_name: null,
    scene_intro: [],
    scene_outro: [],
    ...overrides,
  }
}

function progress(nodeId: string, victories: number, completed: boolean): CampaignNodeProgress {
  return {
    owner_id: 'owner-1',
    node_id: nodeId,
    victories,
    completed_at: completed ? '2026-10-13T00:00:00Z' : null,
  }
}

// town -> route (repeatable) -> gym
const content: CampaignContent = {
  nodes: [
    node('gym', 3, { kind: 'gym', encounter_kind: 'gymLeader', required_victories: 1 }),
    node('town', 1, { kind: 'story', encounter_kind: 'milestone', required_victories: 1 }),
    node('route', 2, { repeatable: true }),
  ],
  prerequisites: [
    { node_id: 'route', requires_node_id: 'town' },
    { node_id: 'gym', requires_node_id: 'route' },
  ],
}

function statuses(progressRows: CampaignNodeProgress[]) {
  return buildJourney(content, progressRows).map((entry) => [entry.node.id, entry.status])
}

describe('buildJourney', () => {
  it('orders by story order and unlocks only the starting node for a new player', () => {
    expect(statuses([])).toEqual([
      ['town', 'available'],
      ['route', 'locked'],
      ['gym', 'locked'],
    ])
  })

  it('unlocks a node once its prerequisite is completed', () => {
    expect(statuses([progress('town', 1, true)])).toEqual([
      ['town', 'completed'],
      ['route', 'available'],
      ['gym', 'locked'],
    ])
  })

  it('keeps the next node locked while the prerequisite only has partial victories', () => {
    const journey = buildJourney(content, [progress('town', 1, true), progress('route', 2, false)])
    expect(journey.map((entry) => entry.status)).toEqual(['completed', 'available', 'locked'])
    expect(journey[1]?.victories).toBe(2)
  })

  it('requires every prerequisite, not just one', () => {
    const twoPrerequisites: CampaignContent = {
      nodes: [node('a', 1), node('b', 2), node('c', 3)],
      prerequisites: [
        { node_id: 'c', requires_node_id: 'a' },
        { node_id: 'c', requires_node_id: 'b' },
      ],
    }
    const journey = buildJourney(twoPrerequisites, [progress('a', 3, true)])
    expect(journey[2]?.status).toBe('locked')
  })
})

describe('pickObjective', () => {
  it('is the earliest node still in progress', () => {
    expect(pickObjective(buildJourney(content, []))?.node.id).toBe('town')
    expect(pickObjective(buildJourney(content, [progress('town', 1, true)]))?.node.id).toBe('route')
  })

  it('falls back to the latest repeatable route once the story is finished', () => {
    const finished = [
      progress('town', 1, true),
      progress('route', 3, true),
      progress('gym', 1, true),
    ]
    expect(pickObjective(buildJourney(content, finished))?.node.id).toBe('route')
  })

  it('is null when there is no content at all', () => {
    expect(pickObjective([])).toBeNull()
  })
})
