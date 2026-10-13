import { describe, expect, it } from 'vitest'
import { generateRandomEncounter, pickEncounterKind } from './encounter-generator'

describe('pickEncounterKind', () => {
  it('picks wild at the very bottom of the roll', () => {
    expect(pickEncounterKind(() => 0)).toBe('wild')
  })

  it('picks milestone at the very top of the roll', () => {
    expect(pickEncounterKind(() => 0.9999999)).toBe('milestone')
  })

  it('picks trainer just past the wild band (50/100)', () => {
    expect(pickEncounterKind(() => 0.51)).toBe('trainer')
  })
})

describe('generateRandomEncounter', () => {
  it('produces a difficulty between 1 and 5 inclusive', () => {
    expect(generateRandomEncounter(() => 0).difficulty).toBe(1)
    expect(generateRandomEncounter(() => 0.9999999).difficulty).toBe(5)
  })

  it('is deterministic for a fixed random source', () => {
    const encounter = generateRandomEncounter(() => 0.2)
    expect(encounter).toEqual({ kind: 'wild', difficulty: 2 })
  })
})
