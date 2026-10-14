import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBattle,
  getBattleById,
  getBattleForFocusSession,
  getBattleForTask,
} from './battles-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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

describe('createBattle', () => {
  it('inserts a task commitment with the right shape', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValue(builder)

    await createBattle('owner-1', {
      commitmentType: 'task',
      encounterKind: 'trainer',
      encounterDifficulty: 3,
      minDifficulty: 3,
      taskId: 'task-1',
      encounterId: 'encounter-1',
    })

    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'owner-1',
      encounter_kind: 'trainer',
      encounter_difficulty: 3,
      commitment_type: 'task',
      commitment_min_difficulty: 3,
      task_id: 'task-1',
      encounter_id: 'encounter-1',
    })
  })

  it('inserts a focus session commitment with the right shape', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValue(builder)

    await createBattle('owner-1', {
      commitmentType: 'focusSession',
      encounterKind: 'wild',
      encounterDifficulty: 1,
      minDurationMinutes: 15,
      focusSessionId: 'session-1',
      encounterId: 'encounter-1',
    })

    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'owner-1',
      encounter_kind: 'wild',
      encounter_difficulty: 1,
      commitment_type: 'focusSession',
      commitment_min_duration_minutes: 15,
      focus_session_id: 'session-1',
      encounter_id: 'encounter-1',
    })
  })

  it('throws when the insert fails (e.g. duplicate battle for the same task)', async () => {
    const builder = createQueryBuilderMock({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    fromMock.mockReturnValue(builder)

    await expect(
      createBattle('owner-1', {
        commitmentType: 'task',
        encounterKind: 'wild',
        encounterDifficulty: 1,
        minDifficulty: 1,
        taskId: 'task-1',
        encounterId: 'encounter-1',
      }),
    ).rejects.toBeTruthy()
  })
})

describe('getBattleById / getBattleForTask / getBattleForFocusSession', () => {
  it('fetches by id', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getBattleById('1')).toEqual({ id: '1' })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })

  it('fetches by task id', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getBattleForTask('task-1')).toEqual({ id: '1' })
    expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1')
  })

  it('fetches by focus session id', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getBattleForFocusSession('session-1')).toBeNull()
    expect(builder.eq).toHaveBeenCalledWith('focus_session_id', 'session-1')
  })
})
