import { useProfile } from '../hooks/use-profile'
import { useUpdateTimezone } from '../hooks/use-update-timezone'

export function TimezoneSettings() {
  const { data: profile, isLoading } = useProfile()
  const updateTimezone = useUpdateTimezone()

  if (isLoading || !profile) return null

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const matchesBrowser = profile.timezone === browserTimezone

  return (
    <div className="card flex flex-col gap-2">
      <h2 className="font-semibold text-ink">Fuso horário</h2>
      <p className="text-sm text-ink-muted">
        Usado para agrupar o histórico de foco por dia (ex.: "hoje"). Atual:{' '}
        <span className="text-ink">{profile.timezone}</span>
      </p>
      {!matchesBrowser && (
        <button
          type="button"
          onClick={() => updateTimezone.mutate(browserTimezone)}
          disabled={updateTimezone.isPending}
          className="btn btn-secondary btn-sm self-start"
        >
          Usar fuso deste navegador ({browserTimezone})
        </button>
      )}
    </div>
  )
}
