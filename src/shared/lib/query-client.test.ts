import { describe, expect, it } from 'vitest'
import { queryClient } from './query-client'

describe('queryClient', () => {
  it('defaults to a positive stale time so revisits reuse cache', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBeGreaterThan(0)
  })

  it('does not retry RLS/permission errors', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry
    if (typeof retry !== 'function') throw new Error('retry must be a function')
    const rlsError = Object.assign(new Error('denied'), { code: '42501' })
    expect(retry(0, rlsError)).toBe(false)
  })

  it('retries other errors up to the configured limit', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry
    if (typeof retry !== 'function') throw new Error('retry must be a function')
    expect(retry(0, new Error('network blip'))).toBe(true)
    expect(retry(1, new Error('network blip'))).toBe(false)
  })

  it('does not retry mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false)
  })
})
