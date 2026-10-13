import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  getProfile,
  updateFocusPreferences,
  updateTimezone,
} from '@/features/settings/api/profile-repository'
import { SettingsPage } from './SettingsPage'

vi.mock('@/features/settings/api/profile-repository', () => ({
  getProfile: vi.fn(),
  updateFocusPreferences: vi.fn(),
  updateTimezone: vi.fn(),
}))

const getProfileMock = vi.mocked(getProfile)
const updateFocusPreferencesMock = vi.mocked(updateFocusPreferences)
const updateTimezoneMock = vi.mocked(updateTimezone)

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'owner-1',
    timezone: 'UTC',
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getProfileMock.mockReset().mockResolvedValue(makeProfile() as never)
  updateFocusPreferencesMock.mockReset()
  updateTimezoneMock.mockReset()
  useAuthStore.setState({ status: 'authenticated', session: { user: { id: 'owner-1' } } as never })
})

describe('SettingsPage', () => {
  it('submits edited presets and rest break durations', async () => {
    renderPage()

    const presetsInput = await screen.findByLabelText(
      'Presets de duração (minutos, separados por vírgula)',
    )
    await userEvent.clear(presetsInput)
    await userEvent.type(presetsInput, '10, 20, 30')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(updateFocusPreferencesMock).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ presetsMinutes: [10, 20, 30] }),
      ),
    )
  })

  it('rejects invalid preset values without calling the mutation', async () => {
    renderPage()

    const presetsInput = await screen.findByLabelText(
      'Presets de duração (minutos, separados por vírgula)',
    )
    await userEvent.clear(presetsInput)
    await userEvent.type(presetsInput, '0, 999')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(updateFocusPreferencesMock).not.toHaveBeenCalled()
  })

  it('offers to switch to the browser timezone when it differs from the stored one', async () => {
    getProfileMock.mockResolvedValue(makeProfile({ timezone: 'Pacific/Kiritimati' }) as never)
    renderPage()

    const button = await screen.findByRole('button', { name: /Usar fuso deste navegador/ })
    await userEvent.click(button)

    await waitFor(() =>
      expect(updateTimezoneMock).toHaveBeenCalledWith('owner-1', expect.any(String)),
    )
  })

  it('does not offer the switch when the stored timezone already matches the browser', async () => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    getProfileMock.mockResolvedValue(makeProfile({ timezone: browserTimezone }) as never)
    renderPage()

    await screen.findByText(browserTimezone)
    expect(
      screen.queryByRole('button', { name: /Usar fuso deste navegador/ }),
    ).not.toBeInTheDocument()
  })
})
