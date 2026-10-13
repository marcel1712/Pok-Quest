import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTask, getTaskById, listTasks, updateTask } from './tasks-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
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

describe('listTasks', () => {
  it('queries the tasks table without a status filter by default', async () => {
    const builder = createQueryBuilderMock({ data: [{ id: '1' }], error: null })
    fromMock.mockReturnValue(builder)

    const result = await listTasks()

    expect(fromMock).toHaveBeenCalledWith('tasks')
    expect(builder.eq).not.toHaveBeenCalled()
    expect(result).toEqual([{ id: '1' }])
  })

  it('filters by status when provided', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null })
    fromMock.mockReturnValue(builder)

    await listTasks({ status: 'pending' })

    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('throws when the query returns an error', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('boom') })
    fromMock.mockReturnValue(builder)

    await expect(listTasks()).rejects.toThrow('boom')
  })
})

describe('getTaskById', () => {
  it('fetches a single task by id', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', title: 'x' }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await getTaskById('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual({ id: '1', title: 'x' })
  })

  it('returns null when the task does not exist', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    expect(await getTaskById('missing')).toBeNull()
  })
})

describe('createTask', () => {
  it('inserts with the owner id and null defaults for optional fields', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValue(builder)

    await createTask('owner-1', { title: 'Nova tarefa', difficulty: 2 })

    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'owner-1',
      title: 'Nova tarefa',
      description: null,
      category_id: null,
      difficulty: 2,
      due_date: null,
    })
  })

  it('throws when the insert fails', async () => {
    const builder = createQueryBuilderMock({ data: null, error: new Error('insert failed') })
    fromMock.mockReturnValue(builder)

    await expect(createTask('owner-1', { title: 'x', difficulty: 2 })).rejects.toThrow(
      'insert failed',
    )
  })
})

describe('updateTask', () => {
  it('updates by id and returns the updated row', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', status: 'completed' }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await updateTask('1', { status: 'completed' })

    expect(builder.update).toHaveBeenCalledWith({ status: 'completed' })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual({ id: '1', status: 'completed' })
  })

  it('throws when the task does not exist (no row returned)', async () => {
    const builder = createQueryBuilderMock({
      data: null,
      error: { code: 'PGRST116', message: 'no rows returned' },
    })
    fromMock.mockReturnValue(builder)

    await expect(updateTask('missing-id', { status: 'archived' })).rejects.toBeTruthy()
  })
})
