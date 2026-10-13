import type { Encounter, EncounterKind } from './types'

// Placeholder until the campaign/route system (T-028) exists to pick a *real* next
// encounter from region/route data. Weights favor common, low-stakes encounters.
const KIND_WEIGHTS: [EncounterKind, number][] = [
  ['wild', 50],
  ['trainer', 30],
  ['rival', 10],
  ['gymLeader', 7],
  ['milestone', 3],
]

const TOTAL_WEIGHT = KIND_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)

/** `random` is injectable so tests can pass a deterministic source instead of Math.random. */
const FALLBACK_KIND: EncounterKind = KIND_WEIGHTS[KIND_WEIGHTS.length - 1]?.[0] ?? 'wild'

export function pickEncounterKind(random: () => number = Math.random): EncounterKind {
  let roll = random() * TOTAL_WEIGHT
  for (const [kind, weight] of KIND_WEIGHTS) {
    if (roll < weight) return kind
    roll -= weight
  }
  return FALLBACK_KIND
}

export function generateRandomEncounter(random: () => number = Math.random): Encounter {
  return {
    kind: pickEncounterKind(random),
    difficulty: 1 + Math.floor(random() * 5),
  }
}
