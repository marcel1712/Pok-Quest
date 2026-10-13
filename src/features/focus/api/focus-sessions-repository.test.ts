import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getActiveSession,
  getSessionById,
  listCompletedSessions,
  startSession,
  transitionSession,
} from './focus-sessions-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

const fromMock = vi.fn()

vi.mock('@/shared/lib/supabase-client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

beforeEach(() => {
  fromMock.mockReset()
})

describe('getActiveSession', () => {
  it('queries for running/paused sessions and returns the row', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', status: 'running' }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await getActiveSession()

    expect(fromMock).toHaveBeenCalledWith('focus_sessions')
    expect(builder.in).toHaveBeenCalledWith('status', ['running', 'paused'])
    expect(result).toEqual({ id: '1', status: 'running' })
  })

  it('returns null when there is no active session', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getActiveSession()).toBeNull()
  })

  it('throws when the query returns an error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(getActiveSession()).rejects.toThrow('boom')
  })
})

describe('listCompletedSessions', () => {
  it('filters by completed status, ordered most recent first', async () => {
    const builder = createQueryBuilderMock({ data: [{ id: '1' }], error: null })
    fromMock.mockReturnValue(builder)

    const result = await listCompletedSessions()

    expect(builder.eq).toHaveBeenCalledWith('status', 'completed')
    expect(builder.order).toHaveBeenCalledWith('ended_at', { ascending: false })
    expect(result).toEqual([{ id: '1' }])
  })

  it('throws when the query returns an error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(listCompletedSessions()).rejects.toThrow('boom')
  })
})

describe('startSession', () => {
  it('inserts a new session owned by the given user', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', status: 'running' }, error: null })
    fromMock.mockReturnValue(builder)

    await startSession('owner-1', { plannedDurationSeconds: 1500, taskId: null })

    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'owner-1',
      planned_duration_seconds: 1500,
      task_id: null,
    })
  })

  it('resolves a unique-violation conflict by returning the already-active session', async () => {
    const insertBuilder = createQueryBuilderMock({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const activeSession = { id: 'already-active', status: 'running' }
    const selectBuilder = createQueryBuilderMock({ data: activeSession, error: null })

    fromMock.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder)

    const result = await startSession('owner-1', { plannedDurationSeconds: 1500 })

    expect(result).toEqual(activeSession)
  })

  it('throws other errors instead of swallowing them', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('network down') })
    fromMock.mockReturnValue(builder)

    await expect(startSession('owner-1', { plannedDurationSeconds: 1500 })).rejects.toThrow(
      'network down',
    )
  })
})

describe('getSessionById', () => {
  it('fetches a single session by id', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', status: 'paused' }, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getSessionById('1')).toEqual({ id: '1', status: 'paused' })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })

  it('returns null when the session does not exist', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getSessionById('missing')).toBeNull()
  })
})

describe('transitionSession', () => {
  it('updates by id when the row is still in one of the expected statuses', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', status: 'paused' }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await transitionSession('1', ['running'], {
      status: 'paused',
      paused_at: '2026-01-01T00:00:00Z',
    })

    expect(builder.update).toHaveBeenCalledWith({
      status: 'paused',
      paused_at: '2026-01-01T00:00:00Z',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(builder.in).toHaveBeenCalledWith('status', ['running'])
    expect(result).toEqual({ id: '1', status: 'paused' })
  })

  it('throws on a genuine query error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('network down') })
    fromMock.mockReturnValue(builder)

    await expect(transitionSession('1', ['running'], { status: 'paused' })).rejects.toThrow(
      'network down',
    )
  })

  it("resolves a retried request (dropped response) by returning the session's current state instead of erroring or re-patching it", async () => {
    // The conditional update matches zero rows because a prior, successful request
    // already moved the session past 'running' (e.g. confirm already completed it).
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    const currentSession = { id: '1', status: 'completed', ended_at: '2026-01-01T00:00:00Z' }
    const selectBuilder = createQueryBuilderMock({ data: currentSession, error: null })

    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(selectBuilder)

    const result = await transitionSession('1', ['running'], {
      status: 'completed',
      ended_at: '2026-01-01T05:00:00Z', // a later, retried timestamp — must NOT win
    })

    expect(result).toEqual(currentSession)
  })

  it('throws if the session no longer exists at all (not just a status mismatch)', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    const selectBuilder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(selectBuilder)

    await expect(transitionSession('missing', ['running'], { status: 'paused' })).rejects.toThrow()
  })
})
