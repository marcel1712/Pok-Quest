// Versioned so a future rebalance doesn't silently invalidate existing owned_pokemon
// rows without a conscious decision — see docs/DECISIONS.md. Mirrors the SQL copy in
// supabase/migrations/..._add_leveling_and_evolution.sql (same duplication tradeoff
// as the battle engine's formulas — no Edge Function to share one implementation).
export const XP_CURVE_VERSION = 1

export const MAX_LEVEL = 100

/** Total XP required to *be at* `level` (Pokémon's "medium fast" growth curve: n³). */
export function totalXpForLevel(level: number): number {
  return level ** 3
}

export type XpProgress = {
  level: number
  xp: number
  /** XP already earned towards the next level (0 at the level's own threshold). */
  xpIntoLevel: number
  /** XP still needed to reach the next level — 0 once at MAX_LEVEL. */
  xpToNextLevel: number
  /** 0–1, for a progress bar. 1 (full) once at MAX_LEVEL. */
  progress: number
}

export function computeXpProgress(level: number, xp: number): XpProgress {
  if (level >= MAX_LEVEL) {
    return { level, xp, xpIntoLevel: 0, xpToNextLevel: 0, progress: 1 }
  }

  const currentThreshold = totalXpForLevel(level)
  const nextThreshold = totalXpForLevel(level + 1)
  const xpIntoLevel = Math.max(0, xp - currentThreshold)
  const levelSpan = nextThreshold - currentThreshold

  return {
    level,
    xp,
    xpIntoLevel,
    xpToNextLevel: Math.max(0, nextThreshold - xp),
    progress: levelSpan > 0 ? Math.min(1, xpIntoLevel / levelSpan) : 1,
  }
}
