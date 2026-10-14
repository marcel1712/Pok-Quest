import type { OwnedPokemon } from './types'

/**
 * Average level of the active party (0 when it is empty) — the one team figure the
 * battle engine uses. The database computes the same average when it validates a
 * battle's commitment (enforce_campaign_node_on_battle), so what the encounter card
 * shows and what the server accepts agree.
 */
export function computePartyAverageLevel(pokemon: OwnedPokemon[]): number {
  const party = pokemon.filter((entry) => entry.party_position !== null)
  if (party.length === 0) return 0
  return party.reduce((sum, entry) => sum + entry.level, 0) / party.length
}
