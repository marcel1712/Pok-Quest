import { EvolutionPrompt } from '@/features/pokemon/components/EvolutionPrompt'
import { PartyAndBox } from '@/features/pokemon/components/PartyAndBox'
import { SpeciesCatalogGrid } from '@/features/pokemon/components/SpeciesCatalogGrid'
import { useOwnedPokemon } from '@/features/pokemon/hooks/use-owned-pokemon'

export function TeamPage() {
  const { data: pokemon } = useOwnedPokemon()
  const pendingEvolutions = pokemon?.filter((p) => p.pending_evolution_to_pokedex_number) ?? []

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Equipe</h1>
        <p className="mt-2 text-slate-400">
          Capture Pokémon vencendo encontros selvagens na tela de Foco.
        </p>
      </div>

      {pendingEvolutions.length > 0 && (
        <div className="flex flex-col gap-3">
          {pendingEvolutions.map((p) => (
            <EvolutionPrompt key={p.id} pokemon={p} />
          ))}
        </div>
      )}

      <PartyAndBox />

      <div>
        <h2 className="mb-2 font-semibold text-slate-100">Pokédex (catálogo)</h2>
        <SpeciesCatalogGrid />
      </div>
    </section>
  )
}
