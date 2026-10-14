import type { ReactNode } from 'react'
import { useCaptureForBattle } from '@/features/pokemon/hooks/use-capture-for-battle'
import { useCaptureFromBattle } from '@/features/pokemon/hooks/use-pokemon-mutations'
import { useSpeciesByPokedexNumber } from '@/features/pokemon/hooks/use-species-catalog'
import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useRewardEvents } from '@/features/rewards/hooks/use-reward-events'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { ENCOUNTER_LABELS } from '../labels'
import type { Battle, EncounterKind } from '../types'

export function BattleResultCard({
  battle,
  onDismiss,
  children,
}: {
  battle: Battle
  onDismiss: () => void
  /** Extra story content (badge earned, closing scene) shown above "Continuar". */
  children?: ReactNode
}) {
  const { data: rewardEvents } = useRewardEvents({ sourceType: 'battle', sourceId: battle.id })
  const { data: wildSpecies } = useSpeciesByPokedexNumber(battle.wild_species_pokedex_number)
  const { data: capture } = useCaptureForBattle(battle.id)
  const captureFromBattle = useCaptureFromBattle()

  const xpAwarded = rewardEvents?.reduce((sum, event) => sum + event.amount, 0) ?? 0
  const { label, glyph } = ENCOUNTER_LABELS[battle.encounter_kind as EncounterKind]
  const isVictory = battle.result === 'victory'
  const canCapture = isVictory && battle.encounter_kind === 'wild' && Boolean(wildSpecies)

  const commitmentText =
    battle.commitment_type === 'task'
      ? `tarefa de dificuldade ≥ ${battle.commitment_min_difficulty}`
      : `sessão de foco de pelo menos ${battle.commitment_min_duration_minutes} min`

  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        {glyph}
      </span>
      <p className="text-xl font-bold text-ink">
        {isVictory ? `Vitória contra ${label}!` : 'Encontro não concluído'}
      </p>
      <p className="max-w-sm text-ink-muted">
        {isVictory
          ? `Compromisso cumprido: ${commitmentText}.`
          : 'O compromisso combinado não foi cumprido — sem XP de bônus, mas sem penalidade.'}
      </p>
      {isVictory && <p className="text-2xl font-semibold text-accent-soft">+{xpAwarded} XP</p>}

      {canCapture && wildSpecies && (
        <div className="flex flex-col items-center gap-2 rounded-control border border-line bg-surface/50 p-3">
          <SpeciesSprite species={wildSpecies} />
          <p className="text-ink-soft">
            {capture
              ? `${wildSpecies.name} capturado!`
              : `Um ${wildSpecies.name}${battle.wild_level ? ` Nv. ${battle.wild_level}` : ''} apareceu!`}
          </p>
          {!capture && (
            <button
              type="button"
              onClick={() => captureFromBattle.mutate(battle.id)}
              disabled={captureFromBattle.isPending}
              className="btn btn-primary"
            >
              {captureFromBattle.isPending ? 'Capturando…' : 'Capturar'}
            </button>
          )}
          {captureFromBattle.isError && (
            <p role="alert" className="text-sm text-danger">
              {toFriendlyErrorMessage(captureFromBattle.error)}
            </p>
          )}
        </div>
      )}

      {children}

      <button type="button" onClick={onDismiss} className="btn btn-secondary">
        Continuar
      </button>
    </div>
  )
}
