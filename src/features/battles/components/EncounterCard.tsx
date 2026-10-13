import { getViableCommitments } from '../engine'
import { ENCOUNTER_LABELS } from '../labels'
import type { Commitment, Encounter, PartySnapshot } from '../types'

export function EncounterCard({
  encounter,
  locationName,
  party,
  commitmentType,
  onAccept,
  onSkip,
}: {
  encounter: Encounter
  /** Where in the campaign this encounter happens, e.g. "Rota 201". */
  locationName?: string
  party: PartySnapshot
  /** Only the commitment of this type is offered — the caller already knows which
   * activity (task or focus session) this card is being shown for. */
  commitmentType: Commitment['type']
  onAccept: (commitment: Commitment) => void
  onSkip: () => void
}) {
  const { label, glyph } = ENCOUNTER_LABELS[encounter.kind]
  const commitment = getViableCommitments(encounter, party).find((c) => c.type === commitmentType)

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {glyph}
        </span>
        <div>
          {locationName && <p className="text-xs text-slate-400">{locationName}</p>}
          <p className="font-semibold text-slate-100">{label}</p>
          <p className="text-sm text-slate-400">
            Dificuldade {encounter.difficulty}/5 · {'●'.repeat(encounter.difficulty)}
            {'○'.repeat(5 - encounter.difficulty)}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Nível médio do time: {party.averageLevel}
        {party.averageLevel === 0 && ' — você ainda não tem Pokémon capturados'}
      </p>

      {commitment && (
        <p className="text-slate-300">
          Compromisso:{' '}
          {commitment.type === 'task'
            ? `tarefa de dificuldade ≥ ${commitment.minDifficulty}`
            : `sessão de foco de pelo menos ${commitment.minDurationMinutes} min`}
          . Cumprindo, a vitória é garantida.
        </p>
      )}

      <div className="flex gap-3">
        {commitment && (
          <button
            type="button"
            onClick={() => onAccept(commitment)}
            className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            Aceitar encontro
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="rounded px-4 py-2 text-slate-400 outline-none hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Focar sem encontro
        </button>
      </div>
    </div>
  )
}
