export function RestBreakPrompt({
  shortMinutes,
  longMinutes,
  onStart,
  onSkip,
}: {
  shortMinutes: number
  longMinutes: number
  onStart: (minutes: number) => void
  onSkip: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded border border-slate-800 p-4">
      <p className="text-slate-300">Sessão concluída! Quer descansar um pouco antes da próxima?</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onStart(shortMinutes)}
          className="rounded bg-slate-800 px-4 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Descanso curto ({shortMinutes} min)
        </button>
        <button
          type="button"
          onClick={() => onStart(longMinutes)}
          className="rounded bg-slate-800 px-4 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Descanso longo ({longMinutes} min)
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded px-4 py-2 text-slate-400 outline-none hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Pular
        </button>
      </div>
    </div>
  )
}
