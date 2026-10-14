import { useCaptureForBattle } from '@/features/pokemon/hooks/use-capture-for-battle'
import { useCaptureFromBattle } from '@/features/pokemon/hooks/use-pokemon-mutations'
import { useSpeciesByPokedexNumber } from '@/features/pokemon/hooks/use-species-catalog'
import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useRewardEvents } from '@/features/rewards/hooks/use-reward-events'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { ENCOUNTER_LABELS } from '../labels'
import type { Battle, EncounterKind } from '../types'

export function BattleResultCard({ battle, onDismiss }: { battle: Battle; onDismiss: () => void }) {
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
    <div className="flex flex-col items-center gap-3 rounded border border-slate-800 p-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        {glyph}
      </span>
      <p className="text-xl font-bold text-slate-100">
        {isVictory ? `Vitória contra ${label}!` : 'Encontro não concluído'}
      </p>
      <p className="max-w-sm text-slate-400">
        {isVictory
          ? `Compromisso cumprido: ${commitmentText}.`
          : 'O compromisso combinado não foi cumprido — sem XP de bônus, mas sem penalidade.'}
      </p>
      {isVictory && <p className="text-2xl font-semibold text-emerald-400">+{xpAwarded} XP</p>}

      {canCapture && wildSpecies && (
        <div className="flex flex-col items-center gap-2 rounded border border-slate-800 bg-slate-900/50 p-3">
          <SpeciesSprite species={wildSpecies} />
          <p className="text-slate-300">
            {capture
              ? `${wildSpecies.name} capturado!`
              : `Um ${wildSpecies.name}${battle.wild_level ? ` Nv. ${battle.wild_level}` : ''} apareceu!`}
          </p>
          {!capture && (
            <button
              type="button"
              onClick={() => captureFromBattle.mutate(battle.id)}
              disabled={captureFromBattle.isPending}
              className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
            >
              {captureFromBattle.isPending ? 'Capturando…' : 'Capturar'}
            </button>
          )}
          {captureFromBattle.isError && (
            <p role="alert" className="text-sm text-red-400">
              {toFriendlyErrorMessage(captureFromBattle.error)}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="rounded bg-slate-800 px-5 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        Continuar
      </button>
    </div>
  )
}
