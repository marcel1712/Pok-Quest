import { describe, expect, it } from 'vitest'
import type { CampaignNodeContent, CampaignRegionContent } from './schema'
import { sinnoh } from './sinnoh'
import { SINNOH_SCENES } from './sinnoh-scenes'
import { validateCampaignRegion } from './validate'

const starly = { species: 396, minLevel: 2, maxLevel: 3, weight: 10 }

function node(overrides: Partial<CampaignNodeContent> & { id: string }): CampaignNodeContent {
  return {
    kind: 'route',
    title: 'Rota',
    summary: 'Resumo',
    encounter: { kind: 'wild', difficulty: 1 },
    requiredVictories: 1,
    repeatable: false,
    requires: [],
    wildEncounters: [starly],
    ...overrides,
  }
}

function region(nodes: CampaignNodeContent[]): CampaignRegionContent {
  return { id: 'test', name: 'Test', contentVersion: 1, nodes }
}

describe('validateCampaignRegion', () => {
  it('accepts the shipped Sinnoh content', () => {
    expect(validateCampaignRegion(sinnoh)).toEqual([])
  })

  it('ships the full Platinum storyline: eight gyms, then the league', () => {
    const ids = sinnoh.nodes.map((entry) => entry.id)
    const gyms = sinnoh.nodes.filter((entry) => entry.kind === 'gym')

    expect(gyms.map((entry) => entry.npcName)).toEqual([
      'Roark',
      'Gardenia',
      'Fantina',
      'Maylene',
      'Crasher Wake',
      'Byron',
      'Candice',
      'Volkner',
    ])
    expect(ids.indexOf('sinnoh.champion-cynthia')).toBeGreaterThan(
      ids.indexOf('sinnoh.sunyshore-gym'),
    )
    // Once the story is over there must still be somewhere to keep exploring.
    expect(sinnoh.nodes.some((entry) => entry.repeatable)).toBe(true)
  })

  it('accepts a minimal valid region', () => {
    expect(
      validateCampaignRegion(
        region([node({ id: 'test.a' }), node({ id: 'test.b', requires: ['test.a'] })]),
      ),
    ).toEqual([])
  })

  it('reports schema errors with their path', () => {
    const issues = validateCampaignRegion(
      region([node({ id: 'test.a', encounter: { kind: 'wild', difficulty: 9 } })]),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('nodes.0.encounter.difficulty')
  })

  it('reports a broken prerequisite link and the node it leaves unreachable', () => {
    const issues = validateCampaignRegion(
      region([node({ id: 'test.a' }), node({ id: 'test.b', requires: ['test.missing'] })]),
    )
    expect(issues).toContain('test.b: requires unknown node "test.missing"')
    expect(issues).toContain('test.b: unreachable')
  })

  it('reports nodes locked behind a cycle as unreachable', () => {
    const issues = validateCampaignRegion(
      region([
        node({ id: 'test.a' }),
        node({ id: 'test.b', requires: ['test.c'] }),
        node({ id: 'test.c', requires: ['test.b'] }),
      ]),
    )
    expect(issues).toContain('test.b: unreachable')
    expect(issues).toContain('test.c: unreachable')
  })

  it('reports a prerequisite that comes later in the story order', () => {
    const issues = validateCampaignRegion(
      region([
        node({ id: 'test.a' }),
        node({ id: 'test.b', requires: ['test.c'] }),
        node({ id: 'test.c', requires: ['test.a'] }),
      ]),
    )
    expect(issues).toContain('test.b: requires "test.c", which comes later in the story order')
  })

  it('reports duplicate ids, self-references and a missing starting node', () => {
    expect(
      validateCampaignRegion(region([node({ id: 'test.a' }), node({ id: 'test.a' })])),
    ).toContain('test.a: duplicate node id')

    const selfReferencing = validateCampaignRegion(
      region([node({ id: 'test.a', requires: ['test.a'] })]),
    )
    expect(selfReferencing).toContain('test.a: requires itself')
    expect(selfReferencing).toContain(
      'no starting node: at least one node must have no prerequisites',
    )
  })

  it('reports ids outside the region namespace', () => {
    expect(validateCampaignRegion(region([node({ id: 'other.a' })]))).toContain(
      'other.a: id must be prefixed with the region id "test."',
    )
  })

  it('reports encounter kinds that do not fit the node kind', () => {
    expect(
      validateCampaignRegion(
        region([node({ id: 'test.a', kind: 'gym', encounter: { kind: 'wild', difficulty: 3 } })]),
      ),
    ).toContain('test.a: a gym node cannot have a wild encounter')
  })

  it('requires a wild table on wild nodes, and only there', () => {
    expect(validateCampaignRegion(region([node({ id: 'test.a', wildEncounters: [] })]))).toContain(
      'test.a: a wild node needs at least one wild encounter entry',
    )

    expect(
      validateCampaignRegion(
        region([node({ id: 'test.a', encounter: { kind: 'trainer', difficulty: 1 } })]),
      ),
    ).toContain('test.a: only wild nodes can list wild encounters')
  })

  it('rejects species outside the catalog, legendaries and duplicates in a wild table', () => {
    const issues = validateCampaignRegion(
      region([
        node({
          id: 'test.a',
          wildEncounters: [
            starly,
            starly,
            { species: 1, minLevel: 2, maxLevel: 3, weight: 10 },
            { species: 483, minLevel: 50, maxLevel: 50, weight: 1 },
          ],
        }),
      ]),
    )
    expect(issues).toContain('test.a: species #396 is listed twice')
    expect(issues).toContain('test.a: species #1 is not in the catalog')
    expect(issues).toContain('test.a: Dialga is legendary and cannot be a wild encounter')
  })

  it('rejects an inverted level range', () => {
    const issues = validateCampaignRegion(
      region([
        node({
          id: 'test.a',
          wildEncounters: [{ species: 396, minLevel: 5, maxLevel: 3, weight: 10 }],
        }),
      ]),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('minLevel must not exceed maxLevel')
  })

  it('gives every wild Sinnoh node its own table', () => {
    const wildNodes = sinnoh.nodes.filter((entry) => entry.encounter.kind === 'wild')
    expect(wildNodes.length).toBeGreaterThan(25)
    for (const entry of wildNodes) {
      expect(entry.wildEncounters?.length ?? 0, entry.id).toBeGreaterThan(0)
    }
  })

  it('requires a badge on gyms, only on gyms, and each badge only once', () => {
    const gymNode = (id: string, badgeName?: string) =>
      node({
        id,
        kind: 'gym',
        encounter: { kind: 'gymLeader', difficulty: 3 },
        wildEncounters: undefined,
        ...(badgeName ? { badgeName } : {}),
      })

    expect(validateCampaignRegion(region([gymNode('test.a')]))).toContain(
      'test.a: a gym node must award a badge',
    )
    expect(validateCampaignRegion(region([node({ id: 'test.a', badgeName: 'X' })]))).toContain(
      'test.a: only gym nodes can award a badge',
    )
    expect(
      validateCampaignRegion(region([gymNode('test.a', 'Carvão'), gymNode('test.b', 'Carvão')])),
    ).toContain('badge "Carvão" is awarded by more than one node')
    expect(validateCampaignRegion(region([gymNode('test.a', 'Carvão')]))).toEqual([])
  })

  it('every scene in the shipped content belongs to an existing node', () => {
    const withScene = sinnoh.nodes.filter((entry) => entry.scene)
    expect(withScene).toHaveLength(Object.keys(SINNOH_SCENES).length)
    expect(sinnoh.nodes.filter((entry) => entry.kind === 'gym').every((entry) => entry.scene)).toBe(
      true,
    )
  })

  it('reports repeatable nodes that are not routes', () => {
    expect(
      validateCampaignRegion(
        region([
          node({
            id: 'test.a',
            kind: 'gym',
            encounter: { kind: 'gymLeader', difficulty: 3 },
            repeatable: true,
            badgeName: 'Teste',
          }),
        ]),
      ),
    ).toContain('test.a: only route nodes can be repeatable')
  })
})
