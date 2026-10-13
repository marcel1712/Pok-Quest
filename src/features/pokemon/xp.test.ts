import { describe, expect, it } from 'vitest'
import { computeXpProgress, MAX_LEVEL, totalXpForLevel } from './xp'

describe('totalXpForLevel', () => {
  it('follows the cubic (medium-fast) curve', () => {
    expect(totalXpForLevel(1)).toBe(1)
    expect(totalXpForLevel(5)).toBe(125)
    expect(totalXpForLevel(10)).toBe(1000)
  })
})

describe('computeXpProgress', () => {
  it('reports zero progress exactly at a level threshold', () => {
    const progress = computeXpProgress(5, totalXpForLevel(5))
    expect(progress.xpIntoLevel).toBe(0)
    expect(progress.progress).toBe(0)
  })

  it('reports partial progress towards the next level', () => {
    const level5 = totalXpForLevel(5)
    const level6 = totalXpForLevel(6)
    const midpoint = Math.round((level5 + level6) / 2)
    const progress = computeXpProgress(5, midpoint)
    expect(progress.progress).toBeCloseTo(0.5, 1)
    expect(progress.xpToNextLevel).toBe(level6 - midpoint)
  })

  it('caps at full progress once the max level is reached', () => {
    const progress = computeXpProgress(MAX_LEVEL, totalXpForLevel(MAX_LEVEL) + 99999)
    expect(progress.progress).toBe(1)
    expect(progress.xpToNextLevel).toBe(0)
  })

  it('never reports negative values for xp sitting below the level threshold', () => {
    // Shouldn't happen in practice, but the formula must stay well-defined.
    const progress = computeXpProgress(5, 0)
    expect(progress.xpIntoLevel).toBe(0)
    expect(progress.progress).toBeGreaterThanOrEqual(0)
  })
})
