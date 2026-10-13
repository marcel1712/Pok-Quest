import { useSpeciesByPokedexNumber } from '../hooks/use-species-catalog'
import type { OwnedPokemon } from '../types'
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
    </button>
  )
}
