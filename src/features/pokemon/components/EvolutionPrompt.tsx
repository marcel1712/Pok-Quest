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
    <div className="flex flex-wrap items-center gap-4 rounded-control border border-accent/60 bg-accent/10 p-4">
      <div className="flex items-center gap-2">
        {currentSpecies && <SpeciesSprite species={currentSpecies} />}
        <span className="text-ink-muted" aria-hidden="true">
          →
        </span>
        <SpeciesSprite species={nextSpecies} />
      </div>

      <p className="flex-1 text-ink">
        {pokemon.nickname ?? currentSpecies?.name ?? 'Seu Pokémon'} está pronto para evoluir para{' '}
        {nextSpecies.name}!
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => confirmEvolution.mutate(pokemon.id)}
          disabled={confirmEvolution.isPending}
          className="btn btn-primary"
        >
          {confirmEvolution.isPending ? 'Evoluindo…' : 'Evoluir agora'}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="btn btn-ghost">
          Depois
        </button>
      </div>

      {confirmEvolution.isError && (
        <p role="alert" className="w-full text-sm text-danger">
          {toFriendlyErrorMessage(confirmEvolution.error)}
        </p>
      )}
    </div>
  )
}
