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
    <div className="card flex flex-col items-center gap-3">
      <p className="text-ink-soft">Sessão concluída! Quer descansar um pouco antes da próxima?</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => onStart(shortMinutes)} className="btn btn-secondary">
          Descanso curto ({shortMinutes} min)
        </button>
        <button type="button" onClick={() => onStart(longMinutes)} className="btn btn-secondary">
          Descanso longo ({longMinutes} min)
        </button>
        <button type="button" onClick={onSkip} className="btn btn-ghost">
          Pular
        </button>
      </div>
    </div>
  )
}
