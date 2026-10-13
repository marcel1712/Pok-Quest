import { describe, expect, it } from 'vitest'
import { queryClient } from './query-client'

describe('queryClient', () => {
  it('defaults to a positive stale time so revisits reuse cache', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBeGreaterThan(0)
  })
})
