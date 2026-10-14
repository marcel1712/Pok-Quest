import { useSpeciesByPokedexNumber } from '../hooks/use-species-catalog'
import type { OwnedPokemon } from '../types'
import { computeXpProgress } from '../xp'
import { SpeciesSprite } from './SpeciesSprite'
import { ProgressBar } from '@/shared/ui/ProgressBar'

export function OwnedPokemonCard({
  pokemon,
  selected,
  animated = false,
  onClick,
}: {
  pokemon: OwnedPokemon
  selected: boolean
  /** Show the moving sprite — used for the active party. */
  animated?: boolean
  onClick: () => void
}) {
  const { data: species } = useSpeciesByPokedexNumber(pokemon.pokedex_number)
  const xpProgress = computeXpProgress(pokemon.level, pokemon.xp)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-control border p-2 ${
        selected ? 'border-accent bg-accent/10' : 'border-line'
      }`}
    >
      {species && <SpeciesSprite species={species} animated={animated} />}
      <p className="text-sm text-ink">{pokemon.nickname ?? species?.name ?? '…'}</p>
      <p className="text-xs text-ink-muted">Nv. {pokemon.level}</p>
      <ProgressBar label="XP" value={Math.round(xpProgress.progress * 100)} size="sm" />
    </button>
  )
}
