import { useState } from 'react'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { useConfirmEvolution } from '../hooks/use-pokemon-mutations'
import { useSpeciesByPokedexNumber } from '../hooks/use-species-catalog'
import type { OwnedPokemon } from '../types'
import { SpeciesSprite } from './SpeciesSprite'

/**
 * The target species was already decided server-side (the leveling trigger sets
 * `pending_evolution_to_pokedex_number`) — this only confirms or defers it. "Depois"
 * dismisses the prompt just for this visit; the flag stays on the row, so it resumes
 * next time TeamPage is opened (T-026: "pulado e retomado").
 */
export function EvolutionPrompt({ pokemon }: { pokemon: OwnedPokemon }) {
  const [dismissed, setDismissed] = useState(false)
  const { data: currentSpecies } = useSpeciesByPokedexNumber(pokemon.pokedex_number)
  const { data: nextSpecies } = useSpeciesByPokedexNumber(
    pokemon.pending_evolution_to_pokedex_number,
  )
  const confirmEvolution = useConfirmEvolution()

  if (dismissed || !nextSpecies) return null

  return (
    <div className="flex flex-wrap items-center gap-4 rounded border border-emerald-700 bg-emerald-900/20 p-4">
      <div className="flex items-center gap-2">
        {currentSpecies && <SpeciesSprite species={currentSpecies} />}
        <span className="text-slate-400" aria-hidden="true">
          →
        </span>
        <SpeciesSprite species={nextSpecies} />
      </div>

      <p className="flex-1 text-slate-100">
        {pokemon.nickname ?? currentSpecies?.name ?? 'Seu Pokémon'} está pronto para evoluir para{' '}
        {nextSpecies.name}!
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => confirmEvolution.mutate(pokemon.id)}
          disabled={confirmEvolution.isPending}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
        >
          {confirmEvolution.isPending ? 'Evoluindo…' : 'Evoluir agora'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded px-4 py-2 text-slate-400 outline-none hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Depois
        </button>
      </div>

      {confirmEvolution.isError && (
        <p role="alert" className="w-full text-sm text-red-400">
          {toFriendlyErrorMessage(confirmEvolution.error)}
        </p>
      )}
    </div>
  )
}
