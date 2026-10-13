export type EncounterKind = 'wild' | 'trainer' | 'rival' | 'gymLeader' | 'milestone'

export type Encounter = {
  kind: EncounterKind
  /** 1–5. Independent of any single task/session — see docs/GAME_RULES.md. */
  difficulty: number
}

/** Deliberately minimal — no types/matchups yet, since the Pokémon catalog (T-024)
 * doesn't exist. `averageLevel` defaults to 0 for a user with no party at all. */
export type PartySnapshot = {
  averageLevel: number
}

export type Commitment =
  { type: 'task'; minDifficulty: number } | { type: 'focusSession'; minDurationMinutes: number }

export type CommitmentFulfillment =
  | { type: 'task'; difficulty: number }
  | { type: 'focusSession'; durationMinutes: number; wasConfirmed: boolean }

export type BattleOutcome = {
  result: 'victory' | 'withdrawal'
  xpAwarded: number
  teamMultiplierApplied: number
}
