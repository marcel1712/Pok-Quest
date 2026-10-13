import { type FormEvent, useState } from 'react'
import { useFocusPreferences, useUpdateFocusPreferences } from '../hooks/use-focus-preferences'
import { focusPreferencesSchema } from '../schemas'

export function FocusPreferencesForm() {
  const { preferences, isLoading } = useFocusPreferences()
  const updatePreferences = useUpdateFocusPreferences()
  const [presetsText, setPresetsText] = useState(() => preferences.presetsMinutes.join(', '))
  const [shortBreak, setShortBreak] = useState(preferences.restBreakMinutes.short)
  const [longBreak, setLongBreak] = useState(preferences.restBreakMinutes.long)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <p className="text-slate-400">Carregando…</p>

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const presetsMinutes = presetsText
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value))

    const result = focusPreferencesSchema.safeParse({
      presetsMinutes,
      restBreakMinutes: { short: shortBreak, long: longBreak },
      soundEnabled: preferences.soundEnabled,
      reduceMotion: preferences.reduceMotion,
    })

    if (!result.success) {
      setError('Verifique os valores: presets de 1 a 120 min, descansos de 1 a 60 min.')
      return
    }

    setError(null)
    updatePreferences.mutate(result.data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded border border-slate-800 p-4"
    >
      <h2 className="font-semibold text-slate-100">Pomodoro</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="presets" className="text-sm text-slate-400">
          Presets de duração (minutos, separados por vírgula)
        </label>
        <input
          id="presets"
          type="text"
          value={presetsText}
          onChange={(event) => setPresetsText(event.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="short-break" className="text-sm text-slate-400">
            Descanso curto (min)
          </label>
          <input
            id="short-break"
            type="number"
            min={1}
            max={60}
            value={shortBreak}
            onChange={(event) => setShortBreak(Number(event.target.value))}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="long-break" className="text-sm text-slate-400">
            Descanso longo (min)
          </label>
          <input
            id="long-break"
            type="number"
            min={1}
            max={60}
            value={longBreak}
            onChange={(event) => setLongBreak(Number(event.target.value))}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={preferences.reduceMotion}
          onChange={(event) =>
            updatePreferences.mutate({ ...preferences, reduceMotion: event.target.checked })
          }
        />
        Reduzir movimento (além da preferência do sistema)
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={updatePreferences.isPending}
        className="self-start rounded bg-emerald-500 px-5 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
      >
        {updatePreferences.isPending ? 'Salvando…' : 'Salvar'}
      </button>

      {updatePreferences.isSuccess && (
        <p role="status" className="text-sm text-emerald-400">
          Preferências salvas.
        </p>
      )}
    </form>
  )
}
