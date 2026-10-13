import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProfile, updateFocusPreferences, updateTimezone } from './profile-repository'

type QueryResult = { data: unknown; error: unknown }

function createQueryBuilderMock(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
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

describe('getProfile', () => {
  it('fetches the profile by id', async () => {
    const builder = createQueryBuilderMock({ data: { id: '1', settings: {} }, error: null })
    fromMock.mockReturnValue(builder)

    const result = await getProfile('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(result).toEqual({ id: '1', settings: {} })
  })
})

describe('updateFocusPreferences', () => {
  it('merges the focus key into existing settings without discarding other keys', async () => {
    const getBuilder = createQueryBuilderMock({
      data: { id: '1', settings: { somethingElse: 'keep-me' } },
      error: null,
    })
    const updateBuilder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValueOnce(getBuilder).mockReturnValueOnce(updateBuilder)

    const preferences = {
      presetsMinutes: [10],
      restBreakMinutes: { short: 5, long: 15 },
      soundEnabled: true,
      reduceMotion: false,
    }
    await updateFocusPreferences('1', preferences)

    expect(updateBuilder.update).toHaveBeenCalledWith({
      settings: { somethingElse: 'keep-me', focus: preferences },
    })
  })

  it('still writes settings even if the profile had none yet', async () => {
    const getBuilder = createQueryBuilderMock({ data: null, error: null })
    const updateBuilder = createQueryBuilderMock({ data: { id: '1' }, error: null })
    fromMock.mockReturnValueOnce(getBuilder).mockReturnValueOnce(updateBuilder)

    const preferences = {
      presetsMinutes: [10],
      restBreakMinutes: { short: 5, long: 15 },
      soundEnabled: false,
      reduceMotion: false,
    }
    await updateFocusPreferences('1', preferences)

    expect(updateBuilder.update).toHaveBeenCalledWith({ settings: { focus: preferences } })
  })
})

describe('updateTimezone', () => {
  it('updates the timezone column', async () => {
    const builder = createQueryBuilderMock({
      data: { id: '1', timezone: 'America/Sao_Paulo' },
      error: null,
    })
    fromMock.mockReturnValue(builder)

    await updateTimezone('1', 'America/Sao_Paulo')

    expect(builder.update).toHaveBeenCalledWith({ timezone: 'America/Sao_Paulo' })
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })
})
