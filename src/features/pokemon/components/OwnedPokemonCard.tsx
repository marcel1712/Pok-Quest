import { useSpeciesByPokedexNumber } from '../hooks/use-species-catalog'
import type { OwnedPokemon } from '../types'
import { computeXpProgress } from '../xp'
import { SpeciesSprite } from './SpeciesSprite'

export function OwnedPokemonCard({
  pokemon,
  selected,
  onClick,
}: {
  pokemon: OwnedPokemon
  selected: boolean
  onClick: () => void
}) {
  const { data: species } = useSpeciesByPokedexNumber(pokemon.pokedex_number)
  const xpProgress = computeXpProgress(pokemon.level, pokemon.xp)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded border p-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800'
      }`}
    >
      {species && <SpeciesSprite species={species} />}
      <p className="text-sm text-slate-200">{pokemon.nickname ?? species?.name ?? '…'}</p>
      <p className="text-xs text-slate-500">Nv. {pokemon.level}</p>
      <div
        role="progressbar"
        aria-label="XP"
        aria-valuenow={Math.round(xpProgress.progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full overflow-hidden rounded bg-slate-800"
      >
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.round(xpProgress.progress * 100)}%` }}
        />
      </div>
    </button>
  )
}
