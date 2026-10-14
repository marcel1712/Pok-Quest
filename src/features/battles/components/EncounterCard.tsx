import { getViableCommitments } from '../engine'
import { ENCOUNTER_LABELS } from '../labels'
import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import type { SpeciesCatalogEntry } from '@/features/pokemon/types'
import type { Commitment, Encounter, PartySnapshot } from '../types'

export function EncounterCard({
  encounter,
  locationName,
  wild,
  opponentName,
  rewardText,
  party,
  commitmentType,
  onAccept,
  onSkip,
}: {
  encounter: Encounter
  /** Where in the campaign this encounter happens, e.g. "Rota 201". */
  locationName?: string
  /** The wild Pokémon already rolled (server-side) for this encounter, if any. */
  wild?: { species: SpeciesCatalogEntry; level: number }
  /** Who is being challenged (gym leader, rival...), shown before committing. */
  opponentName?: string
  /** What winning gives beyond XP, e.g. a badge — also shown before committing. */
  rewardText?: string
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
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {wild ? (
          <SpeciesSprite species={wild.species} size={96} animated />
        ) : (
          <span className="text-3xl" aria-hidden="true">
            {glyph}
          </span>
        )}
        <div>
          {locationName && <p className="text-xs text-ink-muted">{locationName}</p>}
          <p className="font-semibold text-ink">
            {wild
              ? `${wild.species.name} selvagem · Nv. ${wild.level}`
              : opponentName
                ? `${label}: ${opponentName}`
                : label}
          </p>
          <p className="text-sm text-ink-muted">
            Dificuldade {encounter.difficulty}/5 · {'●'.repeat(encounter.difficulty)}
            {'○'.repeat(5 - encounter.difficulty)}
          </p>
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Nível médio do time: {Math.round(party.averageLevel)}
        {party.averageLevel === 0 && ' — seu time ativo está vazio'}
      </p>

      {commitment && (
        <p className="text-ink-soft">
          Compromisso:{' '}
          {commitment.type === 'task'
            ? `tarefa de dificuldade ≥ ${commitment.minDifficulty}`
            : `sessão de foco de pelo menos ${commitment.minDurationMinutes} min`}
          . Cumprindo, a vitória é garantida.
        </p>
      )}

      {rewardText && <p className="text-sm text-warning">Recompensa: {rewardText}</p>}

      <div className="flex gap-3">
        {commitment && (
          <button type="button" onClick={() => onAccept(commitment)} className="btn btn-primary">
            Aceitar encontro
          </button>
        )}
        <button type="button" onClick={onSkip} className="btn btn-ghost">
          Focar sem encontro
        </button>
      </div>
    </div>
  )
}
