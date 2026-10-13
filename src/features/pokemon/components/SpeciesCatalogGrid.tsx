import { useSpeciesCatalog } from '../hooks/use-species-catalog'
import { SpeciesSprite } from './SpeciesSprite'

export function SpeciesCatalogGrid() {
  const { data: species, isLoading, isError } = useSpeciesCatalog()

  if (isLoading) return <p className="text-slate-400">Carregando catálogo…</p>

  if (isError) {
    return (
      <p role="alert" className="text-red-400">
        Não foi possível carregar o catálogo.
      </p>
    )
  }

  if (!species || species.length === 0) {
    return <p className="text-slate-400">Nenhuma espécie no catálogo ainda.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {species.map((entry) => (
        <div
          key={entry.pokedex_number}
          className="flex flex-col items-center gap-1 rounded border border-slate-800 p-2"
        >
          <SpeciesSprite species={entry} />
          <p className="text-sm text-slate-200">{entry.name}</p>
          <p className="text-xs text-slate-500">{entry.types.join(' / ')}</p>
          {entry.is_starter && <span className="text-xs text-emerald-400">Inicial</span>}
        </div>
      ))}
    </div>
  )
}
