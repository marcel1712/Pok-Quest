import { describe, expect, it } from 'vitest'
import { computePartyAverageLevel } from './party'
import type { OwnedPokemon } from './types'

function pokemon(level: number, partyPosition: number | null): OwnedPokemon {
  return {
    id: `p-${level}-${partyPosition}`,
    owner_id: 'owner-1',
    pokedex_number: 390,
    nickname: null,
    level,
    xp: level ** 3,
    party_position: partyPosition,
    pending_evolution_to_pokedex_number: null,
    captured_at: '2026-10-13T00:00:00Z',
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
  }
}

describe('computePartyAverageLevel', () => {
  it('is 0 for an empty party', () => {
    expect(computePartyAverageLevel([])).toBe(0)
    expect(computePartyAverageLevel([pokemon(50, null)])).toBe(0)
  })

  it('averages only the Pokémon in the active party, ignoring the box', () => {
    expect(computePartyAverageLevel([pokemon(10, 1), pokemon(15, 2), pokemon(90, null)])).toBe(12.5)
  })
})
