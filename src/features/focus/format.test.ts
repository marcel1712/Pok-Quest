import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('formats whole minutes', () => {
    expect(formatDuration(1500)).toBe('25:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(5)).toBe('00:05')
  })

  it('pads minutes and seconds to two digits', () => {
    expect(formatDuration(65)).toBe('01:05')
  })

  it('clamps negative input to zero', () => {
    expect(formatDuration(-10)).toBe('00:00')
  })
})
