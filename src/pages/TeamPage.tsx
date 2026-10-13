import { PartyAndBox } from '@/features/pokemon/components/PartyAndBox'
import { SpeciesCatalogGrid } from '@/features/pokemon/components/SpeciesCatalogGrid'

export function TeamPage() {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Equipe</h1>
        <p className="mt-2 text-slate-400">
          Capture Pokémon vencendo encontros selvagens na tela de Foco.
        </p>
      </div>

      <PartyAndBox />

      <div>
        <h2 className="mb-2 font-semibold text-slate-100">Pokédex (catálogo)</h2>
        <SpeciesCatalogGrid />
      </div>
    </section>
  )
}
