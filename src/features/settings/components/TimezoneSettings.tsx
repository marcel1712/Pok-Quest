import { useProfile } from '../hooks/use-profile'
import { useUpdateTimezone } from '../hooks/use-update-timezone'

export function TimezoneSettings() {
  const { data: profile, isLoading } = useProfile()
  const updateTimezone = useUpdateTimezone()

  if (isLoading || !profile) return null

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const matchesBrowser = profile.timezone === browserTimezone

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-800 p-4">
      <h2 className="font-semibold text-slate-100">Fuso horário</h2>
      <p className="text-sm text-slate-400">
        Usado para agrupar o histórico de foco por dia (ex.: "hoje"). Atual:{' '}
        <span className="text-slate-200">{profile.timezone}</span>
      </p>
      {!matchesBrowser && (
        <button
          type="button"
          onClick={() => updateTimezone.mutate(browserTimezone)}
          disabled={updateTimezone.isPending}
          className="self-start rounded bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
        >
          Usar fuso deste navegador ({browserTimezone})
        </button>
      )}
    </div>
  )
}
